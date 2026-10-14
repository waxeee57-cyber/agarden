-- ============================================================
-- 02_functions — booking logic, atomically, in the DB.
-- Ported from supabase/migrations/02 + 04. SECURITY DEFINER, auth.uid()
-- and grants removed: only the server (owner role) calls these. The
-- admin_block permission check moved to the app layer (lib/admin).
-- ============================================================

-- get_listing_availability — occupied ranges in [p_from, p_to). No PII.
create or replace function get_listing_availability(p_listing_id uuid, p_from date, p_to date)
returns table (during daterange, kind text)
language sql stable
as $$
  select o.during, o.kind
  from occupancy o
  where o.listing_id = p_listing_id
    and o.during && daterange(p_from, p_to, '[)')
  order by lower(o.during);
$$;

-- quote_booking — PURE calculation, writes nothing.
create or replace function quote_booking(
  p_listing_id uuid, p_check_in date, p_check_out date,
  p_pet boolean default false, p_is_event boolean default false
)
returns jsonb
language plpgsql stable
as $$
declare
  v_listing          listings%rowtype;
  v_nights           int;
  v_has_single_night boolean;
  v_subtotal         int;
  v_surcharge_total  int := 0;
  v_total            int;
  v_applied          jsonb := '[]'::jsonb;
  r                  record;
  v_amt              int;
begin
  select * into v_listing from listings where id = p_listing_id;
  if not found then
    return jsonb_build_object('valid', false, 'reason', 'listing_not_found', 'nights', 0);
  end if;

  v_nights := p_check_out - p_check_in;
  if v_nights < 1 then
    return jsonb_build_object('valid', false, 'reason', 'invalid_dates', 'nights', v_nights);
  end if;

  select exists (
    select 1 from listing_surcharges
    where listing_id = p_listing_id and code = 'single_night' and active
  ) into v_has_single_night;

  -- min-nights rule; a 1-night stay is allowed ONLY when an active single_night surcharge exists.
  if v_nights >= v_listing.min_nights then
    null;
  elsif v_nights = 1 and v_has_single_night then
    null;
  else
    return jsonb_build_object('valid', false, 'reason', 'min_nights',
      'nights', v_nights, 'min_nights', v_listing.min_nights);
  end if;

  v_subtotal := case when v_listing.nightly_rate_huf is null then null
                     else v_nights * v_listing.nightly_rate_huf end;

  for r in
    select code, label, amount_huf, calc from listing_surcharges
    where listing_id = p_listing_id and active
  loop
    if (r.code = 'single_night' and v_nights = 1)
       or (r.code = 'pet' and p_pet)
       or (r.code = 'event' and p_is_event)
    then
      v_amt := case r.calc when 'per_night' then r.amount_huf * v_nights else r.amount_huf end;
      v_surcharge_total := v_surcharge_total + v_amt;
      v_applied := v_applied || jsonb_build_object('code', r.code, 'label', r.label, 'amount_huf', v_amt, 'calc', r.calc);
    end if;
  end loop;

  v_total := case when v_subtotal is null then null else v_subtotal + v_surcharge_total end;

  return jsonb_build_object(
    'valid', true, 'reason', null, 'nights', v_nights,
    'pricing_mode', v_listing.pricing_mode, 'currency', 'HUF',
    'subtotal_huf', v_subtotal, 'surcharge_total_huf', v_surcharge_total,
    'applied_surcharges', v_applied, 'total_huf', v_total
  );
end;
$$;

-- book_listing — re-validate, insert booking + occupancy in ONE transaction.
create or replace function book_listing(
  p_listing_id uuid, p_check_in date, p_check_out date,
  p_guest_name text, p_guest_email text, p_guests_count int,
  p_guest_phone text default null, p_pet boolean default false,
  p_is_event boolean default false, p_notes text default null,
  p_status text default 'pending', p_source text default 'web'
)
returns jsonb
language plpgsql
as $$
declare
  v_quote      jsonb;
  v_booking_id uuid;
begin
  if p_status not in ('pending', 'confirmed') then
    return jsonb_build_object('ok', false, 'reason', 'invalid_status');
  end if;

  v_quote := quote_booking(p_listing_id, p_check_in, p_check_out, p_pet, p_is_event);
  if not (v_quote->>'valid')::boolean then
    return jsonb_build_object('ok', false, 'reason', coalesce(v_quote->>'reason', 'invalid'));
  end if;

  begin
    insert into bookings (
      listing_id, guest_name, guest_email, guest_phone, check_in, check_out, nights,
      guests_count, pet, is_event, status, subtotal_huf, surcharge_total_huf, total_huf, notes, source
    ) values (
      p_listing_id, p_guest_name, p_guest_email, p_guest_phone, p_check_in, p_check_out,
      (v_quote->>'nights')::int, p_guests_count, p_pet, p_is_event, p_status,
      (v_quote->>'subtotal_huf')::int, coalesce((v_quote->>'surcharge_total_huf')::int, 0),
      (v_quote->>'total_huf')::int, p_notes, p_source
    )
    returning id into v_booking_id;

    insert into occupancy (listing_id, during, kind, booking_id)
    values (p_listing_id, daterange(p_check_in, p_check_out, '[)'), 'booking', v_booking_id);
  exception
    when exclusion_violation then
      return jsonb_build_object('ok', false, 'reason', 'overlap');
  end;

  return jsonb_build_object('ok', true, 'booking_id', v_booking_id,
    'nights', (v_quote->>'nights')::int, 'total_huf', (v_quote->>'total_huf')::int);
end;
$$;

-- admin_block — manual/external block. Caller (app layer) has ALREADY
-- verified the session may manage p_listing_id.
create or replace function admin_block(
  p_listing_id uuid, p_from date, p_to date,
  p_kind text default 'manual', p_note text default null
)
returns jsonb
language plpgsql
as $$
declare
  v_id uuid;
begin
  if p_kind not in ('manual', 'external') then
    return jsonb_build_object('ok', false, 'reason', 'invalid_kind');
  end if;
  if p_to <= p_from then
    return jsonb_build_object('ok', false, 'reason', 'invalid_dates');
  end if;
  if not exists (select 1 from listings where id = p_listing_id) then
    return jsonb_build_object('ok', false, 'reason', 'listing_not_found');
  end if;

  begin
    insert into occupancy (listing_id, during, kind, note)
    values (p_listing_id, daterange(p_from, p_to, '[)'), p_kind, p_note)
    returning id into v_id;
  exception
    when exclusion_violation then
      return jsonb_build_object('ok', false, 'reason', 'overlap');
  end;

  return jsonb_build_object('ok', true, 'occupancy_id', v_id);
end;
$$;
