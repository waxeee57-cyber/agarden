-- ============================================================
-- 03_app_layer — lead capture + admin status transitions.
-- Ported from supabase/migrations/04 (request_quote) + new
-- admin_set_booking_status (confirm/cancel, occupancy in sync).
-- ============================================================

-- request_quote — lead capture. Inserts a 'quote_request' booking, NO occupancy.
create or replace function request_quote(
  p_listing_id uuid, p_guest_name text, p_guest_email text,
  p_check_in date default null, p_check_out date default null,
  p_guest_phone text default null, p_guests_count int default null,
  p_pet boolean default false, p_is_event boolean default false, p_message text default null
)
returns jsonb
language plpgsql
as $$
declare
  v_nights int := null;
  v_booking_id uuid;
begin
  if not exists (select 1 from listings where id = p_listing_id) then
    return jsonb_build_object('ok', false, 'reason', 'listing_not_found');
  end if;
  if p_check_in is not null and p_check_out is not null then
    if p_check_out <= p_check_in then
      return jsonb_build_object('ok', false, 'reason', 'invalid_dates');
    end if;
    v_nights := p_check_out - p_check_in;
  end if;

  insert into bookings (
    listing_id, guest_name, guest_email, guest_phone, check_in, check_out, nights,
    guests_count, pet, is_event, status, notes
  ) values (
    p_listing_id, p_guest_name, p_guest_email, p_guest_phone, p_check_in, p_check_out,
    v_nights, p_guests_count, p_pet, p_is_event, 'quote_request', p_message
  )
  returning id into v_booking_id;

  return jsonb_build_object('ok', true, 'booking_id', v_booking_id, 'status', 'quote_request');
end;
$$;

-- admin_set_booking_status (confirm/cancel, occupancy in sync).
-- ============================================================

-- admin_set_booking_status — confirm / cancel with occupancy kept in sync,
-- in one transaction. Scoped by p_listing_id so a booking of another
-- listing can never be touched (defence in depth over the app check).
create or replace function admin_set_booking_status(p_booking_id uuid, p_listing_id uuid, p_status text)
returns jsonb
language plpgsql
as $$
declare
  b bookings%rowtype;
begin
  if p_status not in ('confirmed', 'cancelled') then
    return jsonb_build_object('ok', false, 'reason', 'invalid_status');
  end if;

  select * into b from bookings where id = p_booking_id and listing_id = p_listing_id for update;
  if not found then
    return jsonb_build_object('ok', false, 'reason', 'not_found');
  end if;

  if p_status = 'cancelled' then
    delete from occupancy where booking_id = b.id;
    update bookings set status = 'cancelled' where id = b.id;
    return jsonb_build_object('ok', true, 'status', 'cancelled');
  end if;

  -- confirm: a booking must hold its dates. A quote_request gets its occupancy now.
  if b.check_in is null or b.check_out is null then
    return jsonb_build_object('ok', false, 'reason', 'missing_dates');
  end if;
  if not exists (select 1 from occupancy where booking_id = b.id) then
    begin
      insert into occupancy (listing_id, during, kind, booking_id)
      values (b.listing_id, daterange(b.check_in, b.check_out, '[)'), 'booking', b.id);
    exception
      when exclusion_violation then
        return jsonb_build_object('ok', false, 'reason', 'overlap');
    end;
  end if;
  update bookings set status = 'confirmed' where id = b.id;
  return jsonb_build_object('ok', true, 'status', 'confirmed');
end;
$$;
