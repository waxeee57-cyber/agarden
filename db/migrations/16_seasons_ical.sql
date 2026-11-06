-- 16_seasons_ical — seasonal nightly rates, headcount surcharge, iCal sync.
--
-- Pricing stays in SQL: quote_booking prices EVERY NIGHT on its own (the
-- season containing that night, else the base rate). If any night has no
-- rate, the stay is "egyedi ajánlat" (subtotal null), exactly as before.
-- A season's min_nights applies to stays ARRIVING in that season.

create table if not exists listing_seasons (
  id               uuid primary key default gen_random_uuid(),
  listing_id       uuid not null references listings on delete cascade,
  label            text not null check (length(label) between 2 and 60),
  during           daterange not null check (not isempty(during)),
  nightly_rate_huf int not null check (nightly_rate_huf between 1000 and 5000000),
  min_nights       int check (min_nights between 1 and 30),
  created_at       timestamptz default now(),
  constraint listing_seasons_no_overlap exclude using gist (listing_id with =, during with &&)
);

alter table listings add column if not exists extra_guest_from int check (extra_guest_from between 1 and 50);
alter table listings add column if not exists extra_guest_huf  int check (extra_guest_huf between 0 and 1000000);

-- ---------- iCal ----------
-- export: a secret token per house -> /api/ical/<token> (Airbnb/Booking import it)
alter table listings add column if not exists ical_token text unique;
update listings set ical_token = replace(gen_random_uuid()::text || gen_random_uuid()::text, '-', '') where ical_token is null;

-- import: external calendars; their busy days land in occupancy (kind 'external')
create table if not exists ical_feeds (
  id          uuid primary key default gen_random_uuid(),
  listing_id  uuid not null references listings on delete cascade,
  label       text not null check (length(label) between 2 and 40),
  url         text not null check (url ~ '^https://'),
  last_sync   timestamptz,
  last_error  text,
  last_count  int,
  created_at  timestamptz default now(),
  unique (listing_id, url)
);
alter table occupancy add column if not exists feed_id uuid references ical_feeds on delete cascade;
create index if not exists occupancy_feed_idx on occupancy (feed_id) where feed_id is not null;

-- ---------- pricing ----------
drop function if exists quote_booking(uuid, date, date, boolean, boolean);

create or replace function quote_booking(
  p_listing_id uuid, p_check_in date, p_check_out date,
  p_pet boolean default false, p_is_event boolean default false, p_guests int default null
) returns jsonb
language plpgsql stable as $$
declare
  v_listing          listings%rowtype;
  v_nights           int;
  v_min              int;
  v_has_single_night boolean;
  v_subtotal         int;
  v_missing          boolean;
  v_breakdown        jsonb;
  v_surcharge_total  int := 0;
  v_total            int;
  v_applied          jsonb := '[]'::jsonb;
  r                  record;
  v_amt              int;
  v_extra            int;
begin
  select * into v_listing from listings where id = p_listing_id;
  if not found then
    return jsonb_build_object('valid', false, 'reason', 'listing_not_found', 'nights', 0);
  end if;

  v_nights := p_check_out - p_check_in;
  if v_nights < 1 then
    return jsonb_build_object('valid', false, 'reason', 'invalid_dates', 'nights', v_nights);
  end if;

  -- min nights: the arrival night's season wins over the house default
  select coalesce(
    (select s.min_nights from listing_seasons s where s.listing_id = p_listing_id and s.during @> p_check_in),
    v_listing.min_nights) into v_min;

  select exists (select 1 from listing_surcharges where listing_id = p_listing_id and code = 'single_night' and active)
    into v_has_single_night;

  if v_nights >= v_min then
    null;
  elsif v_nights = 1 and v_has_single_night then
    null;
  else
    return jsonb_build_object('valid', false, 'reason', 'min_nights', 'nights', v_nights, 'min_nights', v_min);
  end if;

  -- every night priced on its own
  with n as (
    select g::date as d, s.label, coalesce(s.nightly_rate_huf, v_listing.nightly_rate_huf) as rate
      from generate_series(p_check_in, p_check_out - 1, interval '1 day') g
      left join listing_seasons s on s.listing_id = p_listing_id and s.during @> g::date
  ), grp as (
    select coalesce(label, 'Alapár') as label, rate, count(*)::int as nights, min(d) as first_night
      from n group by coalesce(label, 'Alapár'), rate
  )
  select bool_or(rate is null),
         sum(rate * nights)::int,
         coalesce(jsonb_agg(jsonb_build_object('label', label, 'nights', nights, 'rate_huf', rate) order by first_night), '[]'::jsonb)
    into v_missing, v_subtotal, v_breakdown
    from grp;
  if v_missing then
    v_subtotal := null;
    v_breakdown := '[]'::jsonb;
  end if;

  for r in select code, label, amount_huf, calc from listing_surcharges where listing_id = p_listing_id and active loop
    if (r.code = 'single_night' and v_nights = 1) or (r.code = 'pet' and p_pet) or (r.code = 'event' and p_is_event) then
      v_amt := case r.calc when 'per_night' then r.amount_huf * v_nights else r.amount_huf end;
      v_surcharge_total := v_surcharge_total + v_amt;
      v_applied := v_applied || jsonb_build_object('code', r.code, 'label', r.label, 'amount_huf', v_amt, 'calc', r.calc);
    end if;
  end loop;

  -- headcount surcharge: per person above the threshold, per night
  if p_guests is not null and v_listing.extra_guest_from is not null and coalesce(v_listing.extra_guest_huf, 0) > 0
     and p_guests > v_listing.extra_guest_from then
    v_extra := p_guests - v_listing.extra_guest_from;
    v_amt := v_extra * v_listing.extra_guest_huf * v_nights;
    v_surcharge_total := v_surcharge_total + v_amt;
    v_applied := v_applied || jsonb_build_object('code', 'extra_guest', 'label', format('Létszámfelár (%s fő × %s éj)', v_extra, v_nights), 'amount_huf', v_amt, 'calc', 'per_night');
  end if;

  v_total := case when v_subtotal is null then null else v_subtotal + v_surcharge_total end;

  return jsonb_build_object(
    'valid', true, 'reason', null, 'nights', v_nights, 'min_nights', v_min,
    'pricing_mode', v_listing.pricing_mode, 'currency', 'HUF',
    'subtotal_huf', v_subtotal, 'nightly_breakdown', v_breakdown,
    'surcharge_total_huf', v_surcharge_total, 'applied_surcharges', v_applied, 'total_huf', v_total
  );
end;
$$;

create or replace function book_listing(
  p_listing_id uuid, p_check_in date, p_check_out date, p_guest_name text, p_guest_email text, p_guests_count integer,
  p_guest_phone text default null, p_pet boolean default false, p_is_event boolean default false, p_notes text default null,
  p_status text default 'pending', p_source text default 'web'
) returns jsonb
language plpgsql as $$
declare
  v_quote      jsonb;
  v_booking_id uuid;
begin
  if p_status not in ('pending', 'confirmed') then
    return jsonb_build_object('ok', false, 'reason', 'invalid_status');
  end if;

  v_quote := quote_booking(p_listing_id, p_check_in, p_check_out, p_pet, p_is_event, p_guests_count);
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
