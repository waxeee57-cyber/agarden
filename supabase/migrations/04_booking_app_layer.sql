-- ============================================================
-- 04_booking_app_layer — ADDITIVE support for the slice-2 app layer.
-- Slice-1 migrations are NOT modified. Two additions, each justified:
--
--   1. get_listing_booking_meta — the app-level capacity check needs a
--      listing's capacity for ANY listing (incl. 'placeholder', which anon RLS
--      hides). This PII-free SECURITY DEFINER RPC exposes only booking-relevant
--      metadata so the app stays on the anon client (no service_role).
--
--   2. request_quote — a quote request is a LEAD, not a reservation: it must NOT
--      block dates. book_listing always writes occupancy, so quote requests get
--      their own RPC that inserts a 'quote_request' booking WITHOUT occupancy,
--      and tolerates soft (missing) dates. Booking date columns are relaxed to
--      NULLable to allow dateless quote requests (real bookings via book_listing
--      always supply them). The existing CHECK (check_out > check_in) already
--      passes when either side is NULL, so it is left untouched.
-- ============================================================

-- Relax NOT NULL so a dateless quote_request can be stored. book_listing still
-- always provides these, so confirmed/pending bookings are unaffected.
alter table bookings alter column check_in     drop not null;
alter table bookings alter column check_out    drop not null;
alter table bookings alter column nights       drop not null;
alter table bookings alter column guests_count drop not null;

-- ------------------------------------------------------------
-- get_listing_booking_meta — PII-free listing metadata for app validation.
-- ------------------------------------------------------------
create or replace function get_listing_booking_meta(p_listing_id uuid)
returns jsonb
language sql stable security definer set search_path = public, pg_temp
as $$
  select case
    when l.id is null then jsonb_build_object('found', false)
    else jsonb_build_object(
      'found', true,
      'status', l.status,
      'pricing_mode', l.pricing_mode,
      'nightly_rate_huf', l.nightly_rate_huf,
      'capacity_max', l.capacity_max,
      'capacity_extra', coalesce(l.capacity_extra, 0),
      'min_nights', l.min_nights
    )
  end
  from (select p_listing_id as id) q
  left join listings l on l.id = q.id;
$$;

-- ------------------------------------------------------------
-- request_quote — lead capture. Inserts a 'quote_request' booking, NO occupancy.
-- Dates are optional ("soft"); when both present they must be check_out>check_in.
-- ------------------------------------------------------------
create or replace function request_quote(
  p_listing_id   uuid,
  p_guest_name   text,
  p_guest_email  text,
  p_check_in     date default null,
  p_check_out    date default null,
  p_guest_phone  text default null,
  p_guests_count int default null,
  p_pet          boolean default false,
  p_is_event     boolean default false,
  p_message      text default null
)
returns jsonb
language plpgsql security definer set search_path = public, pg_temp
as $$
declare
  v_exists boolean;
  v_nights int := null;
  v_booking_id uuid;
begin
  select exists(select 1 from listings where id = p_listing_id) into v_exists;
  if not v_exists then
    return jsonb_build_object('ok', false, 'reason', 'listing_not_found');
  end if;

  if p_check_in is not null and p_check_out is not null then
    if p_check_out <= p_check_in then
      return jsonb_build_object('ok', false, 'reason', 'invalid_dates');
    end if;
    v_nights := p_check_out - p_check_in;
  end if;

  insert into bookings (
    listing_id, guest_name, guest_email, guest_phone,
    check_in, check_out, nights, guests_count, pet, is_event,
    status, subtotal_huf, surcharge_total_huf, total_huf, notes
  ) values (
    p_listing_id, p_guest_name, p_guest_email, p_guest_phone,
    p_check_in, p_check_out, v_nights, p_guests_count, p_pet, p_is_event,
    'quote_request', null, null, null, p_message
  )
  returning id into v_booking_id;

  -- Intentionally NO occupancy row: a quote request does not reserve dates.
  return jsonb_build_object('ok', true, 'booking_id', v_booking_id, 'status', 'quote_request');
end;
$$;

-- ------------------------------------------------------------
-- Grants — anon may call both via the definer RPCs (no table grants needed).
-- ------------------------------------------------------------
revoke all on function get_listing_booking_meta(uuid) from public;
revoke all on function request_quote(uuid, text, text, date, date, text, int, boolean, boolean, text) from public;

grant execute on function get_listing_booking_meta(uuid) to anon, authenticated;
grant execute on function request_quote(uuid, text, text, date, date, text, int, boolean, boolean, text) to anon, authenticated;
