-- ============================================================
-- 02_garden_functions — booking logic lives here, atomically.
--
-- All functions are SECURITY DEFINER and owned by `postgres` (the migration
-- role), which owns the public tables and therefore bypasses RLS inside the
-- function body. That is what lets an anon caller get an availability list or
-- create a booking through these RPCs WITHOUT any direct table grants —
-- exactly the access model the spec requires.
--
-- `set search_path = public, pg_temp` hardens every definer function against
-- search_path hijacking (a standard Supabase advisor recommendation).
-- ============================================================

-- ------------------------------------------------------------
-- Helpers (used by RLS policies in 03 and by admin_block)
-- ------------------------------------------------------------

-- Is the current JWT user an owner/admin of this tenant? auth.uid() reflects
-- the *caller* even inside SECURITY DEFINER, so this is safe to use in policies.
create or replace function is_tenant_admin(p_tenant_id uuid)
returns boolean
language sql stable security definer set search_path = public, pg_temp
as $$
  select exists (
    select 1 from tenant_members
    where tenant_id = p_tenant_id
      and user_id = auth.uid()
      and role in ('owner', 'admin')
  );
$$;

-- Tenant that owns a listing (definer => no RLS recursion from policies).
create or replace function listing_tenant(p_listing_id uuid)
returns uuid
language sql stable security definer set search_path = public, pg_temp
as $$
  select tenant_id from listings where id = p_listing_id;
$$;

-- ------------------------------------------------------------
-- get_listing_availability — booked ranges in [p_from, p_to). NO guest PII.
-- ------------------------------------------------------------
create or replace function get_listing_availability(
  p_listing_id uuid,
  p_from       date,
  p_to         date
)
returns table (during daterange, kind text)
language sql stable security definer set search_path = public, pg_temp
as $$
  select o.during, o.kind
  from occupancy o
  where o.listing_id = p_listing_id
    and o.during && daterange(p_from, p_to, '[)')
  order by lower(o.during);
$$;

-- ------------------------------------------------------------
-- quote_booking — PURE calculation, writes nothing.
-- Returns: { valid, reason, nights, pricing_mode, currency,
--            subtotal_huf, surcharge_total_huf, applied_surcharges[], total_huf }
-- ------------------------------------------------------------
create or replace function quote_booking(
  p_listing_id uuid,
  p_check_in   date,
  p_check_out  date,
  p_pet        boolean default false,
  p_is_event   boolean default false
)
returns jsonb
language plpgsql stable security definer set search_path = public, pg_temp
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

  -- min-nights rule, with the explicit 1-night exception.
  if v_nights >= v_listing.min_nights then
    null;                                  -- ok
  elsif v_nights = 1 and v_has_single_night then
    null;                                  -- ok: 1-night allowed because surcharge exists
  else
    return jsonb_build_object(
      'valid', false, 'reason', 'min_nights',
      'nights', v_nights, 'min_nights', v_listing.min_nights
    );
  end if;

  -- base price (null nightly_rate => quote-only: total stays null)
  if v_listing.nightly_rate_huf is null then
    v_subtotal := null;
  else
    v_subtotal := v_nights * v_listing.nightly_rate_huf;
  end if;

  -- applicable surcharges
  for r in
    select code, label, amount_huf, calc
    from listing_surcharges
    where listing_id = p_listing_id and active
  loop
    if (r.code = 'single_night' and v_nights = 1)
       or (r.code = 'pet' and p_pet)
       or (r.code = 'event' and p_is_event)
    then
      v_amt := case r.calc
                 when 'per_night' then r.amount_huf * v_nights
                 when 'flat'      then r.amount_huf
                 else r.amount_huf                       -- per_stay
               end;
      v_surcharge_total := v_surcharge_total + v_amt;
      v_applied := v_applied || jsonb_build_object(
        'code', r.code, 'label', r.label, 'amount_huf', v_amt, 'calc', r.calc
      );
    end if;
  end loop;

  if v_subtotal is null then
    v_total := null;                       -- cannot total without a base rate
  else
    v_total := v_subtotal + v_surcharge_total;
  end if;

  return jsonb_build_object(
    'valid', true,
    'reason', null,
    'nights', v_nights,
    'pricing_mode', v_listing.pricing_mode,
    'currency', 'HUF',
    'subtotal_huf', v_subtotal,
    'surcharge_total_huf', v_surcharge_total,
    'applied_surcharges', v_applied,
    'total_huf', v_total
  );
end;
$$;

-- ------------------------------------------------------------
-- book_listing — re-validate, insert booking + occupancy in ONE transaction.
-- The occupancy exclusion constraint is the overlap guarantee; on conflict we
-- roll back the whole subtransaction and return {ok:false, reason:'overlap'}.
-- ------------------------------------------------------------
create or replace function book_listing(
  p_listing_id   uuid,
  p_check_in     date,
  p_check_out    date,
  p_guest_name   text,
  p_guest_email  text,
  p_guests_count int,
  p_guest_phone  text default null,
  p_pet          boolean default false,
  p_is_event     boolean default false,
  p_notes        text default null,
  p_status       text default 'pending'
)
returns jsonb
language plpgsql security definer set search_path = public, pg_temp
as $$
declare
  v_quote      jsonb;
  v_nights     int;
  v_subtotal   int;
  v_surcharge  int;
  v_total      int;
  v_booking_id uuid;
begin
  if p_status not in ('quote_request', 'pending', 'confirmed') then
    return jsonb_build_object('ok', false, 'reason', 'invalid_status');
  end if;

  v_quote := quote_booking(p_listing_id, p_check_in, p_check_out, p_pet, p_is_event);
  if not (v_quote->>'valid')::boolean then
    return jsonb_build_object('ok', false, 'reason', coalesce(v_quote->>'reason', 'invalid'));
  end if;

  v_nights    := (v_quote->>'nights')::int;
  v_subtotal  := (v_quote->>'subtotal_huf')::int;          -- null-safe: ->> of json null is NULL
  v_surcharge := coalesce((v_quote->>'surcharge_total_huf')::int, 0);
  v_total     := (v_quote->>'total_huf')::int;

  begin
    insert into bookings (
      listing_id, guest_name, guest_email, guest_phone,
      check_in, check_out, nights, guests_count, pet, is_event,
      status, subtotal_huf, surcharge_total_huf, total_huf, notes
    ) values (
      p_listing_id, p_guest_name, p_guest_email, p_guest_phone,
      p_check_in, p_check_out, v_nights, p_guests_count, p_pet, p_is_event,
      p_status, v_subtotal, v_surcharge, v_total, p_notes
    )
    returning id into v_booking_id;

    insert into occupancy (listing_id, during, kind, booking_id)
    values (p_listing_id, daterange(p_check_in, p_check_out, '[)'), 'booking', v_booking_id);
  exception
    when exclusion_violation then
      return jsonb_build_object('ok', false, 'reason', 'overlap');
  end;

  return jsonb_build_object(
    'ok', true, 'booking_id', v_booking_id, 'nights', v_nights, 'total_huf', v_total
  );
end;
$$;

-- ------------------------------------------------------------
-- admin_block — manual/external occupancy block. Admin-only (tenant scoped).
-- ------------------------------------------------------------
create or replace function admin_block(
  p_listing_id uuid,
  p_from       date,
  p_to         date,
  p_kind       text default 'manual',
  p_note       text default null
)
returns jsonb
language plpgsql security definer set search_path = public, pg_temp
as $$
declare
  v_tenant uuid;
  v_id     uuid;
begin
  if p_kind not in ('manual', 'external') then
    return jsonb_build_object('ok', false, 'reason', 'invalid_kind');
  end if;
  if p_to <= p_from then
    return jsonb_build_object('ok', false, 'reason', 'invalid_dates');
  end if;

  v_tenant := listing_tenant(p_listing_id);
  if v_tenant is null then
    return jsonb_build_object('ok', false, 'reason', 'listing_not_found');
  end if;
  if not is_tenant_admin(v_tenant) then
    return jsonb_build_object('ok', false, 'reason', 'forbidden');
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

-- ------------------------------------------------------------
-- Execute grants. anon may quote/book/check availability via these definer
-- RPCs only (never the underlying PII tables). admin_block is admin-only.
-- ------------------------------------------------------------
revoke all on function get_listing_availability(uuid, date, date) from public;
revoke all on function quote_booking(uuid, date, date, boolean, boolean) from public;
revoke all on function book_listing(uuid, date, date, text, text, int, text, boolean, boolean, text, text) from public;
revoke all on function admin_block(uuid, date, date, text, text) from public;

grant execute on function get_listing_availability(uuid, date, date) to anon, authenticated;
grant execute on function quote_booking(uuid, date, date, boolean, boolean) to anon, authenticated;
grant execute on function book_listing(uuid, date, date, text, text, int, text, boolean, boolean, text, text) to anon, authenticated;
grant execute on function admin_block(uuid, date, date, text, text) to authenticated;

-- helpers used inside RLS policies must be executable by the querying roles
grant execute on function is_tenant_admin(uuid) to anon, authenticated;
grant execute on function listing_tenant(uuid) to anon, authenticated;
