-- 17_guards_email_log — booking edge guards + a visible e-mail delivery log.
--
-- quote_booking (and therefore book_listing) now refuses: arrival before
-- today in Europe/Budapest, arrival more than 2 years out, stays over 90
-- nights. Everything else is unchanged from 16.
--
-- email_log: every outgoing mail's outcome, so the owner SEES a failed
-- Gmail send in the admin instead of it vanishing into server logs.
-- Pruned to 90 days on write; holds addresses the owner already sees.

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

  -- the house's calendar day (Europe/Budapest), not the server's UTC date:
  -- a guest booking at 00:10 local time may still arrive "today"
  if p_check_in < (now() at time zone 'Europe/Budapest')::date then
    return jsonb_build_object('valid', false, 'reason', 'past_dates', 'nights', v_nights);
  end if;
  if p_check_in > (now() at time zone 'Europe/Budapest')::date + 730 then
    return jsonb_build_object('valid', false, 'reason', 'too_far', 'nights', v_nights);
  end if;
  if v_nights > 90 then
    return jsonb_build_object('valid', false, 'reason', 'too_long', 'nights', v_nights);
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


create table if not exists email_log (
  id          bigint generated always as identity primary key,
  listing_id  uuid references listings on delete cascade,
  kind        text not null,          -- booking | status | contact
  recipient   text not null,
  ok          boolean not null,
  error       text,
  created_at  timestamptz not null default now()
);
create index if not exists email_log_listing_idx on email_log (listing_id, created_at desc);
