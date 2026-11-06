-- 19_instant_booking_events — instant confirmation + a tamper-proof audit trail.
--
-- Web bookings are confirmed on the spot (the app passes status 'confirmed';
-- book_listing already validates dates, min nights and overlap atomically).
-- booking_events is written by TRIGGERS, so every path — web, admin, manual,
-- quote request, delete — is recorded without any code having to remember it.

create table if not exists booking_events (
  id          bigint generated always as identity primary key,
  listing_id  uuid not null references listings on delete cascade,
  booking_id  uuid references bookings on delete set null,
  event       text not null check (event in ('auto_confirmed', 'created', 'quote_request', 'manual_booking', 'confirmed', 'cancelled', 'deleted')),
  detail      jsonb not null default '{}'::jsonb,
  seen        boolean not null default false,
  created_at  timestamptz not null default now()
);
create index if not exists booking_events_listing_idx on booking_events (listing_id, created_at desc);
create index if not exists booking_events_unseen_idx on booking_events (listing_id) where not seen;

create or replace function booking_event_detail(b bookings) returns jsonb language sql immutable as $$
  select jsonb_build_object('guest', b.guest_name, 'check_in', b.check_in, 'check_out', b.check_out,
                            'guests', b.guests_count, 'total', b.total_huf, 'code', upper(left(b.id::text, 8)))
$$;

create or replace function trg_booking_events() returns trigger language plpgsql as $$
begin
  if tg_op = 'INSERT' then
    insert into booking_events (listing_id, booking_id, event, detail)
    values (new.listing_id, new.id,
            case when new.status = 'quote_request' then 'quote_request'
                 when new.status = 'confirmed' and new.source = 'manual' then 'manual_booking'
                 when new.status = 'confirmed' then 'auto_confirmed'
                 else 'created' end,
            booking_event_detail(new));
    return new;
  elsif tg_op = 'UPDATE' then
    if new.status is distinct from old.status and new.status in ('confirmed', 'cancelled') then
      insert into booking_events (listing_id, booking_id, event, detail)
      values (new.listing_id, new.id, new.status, booking_event_detail(new));
    end if;
    return new;
  else -- DELETE
    insert into booking_events (listing_id, booking_id, event, detail)
    values (old.listing_id, null, 'deleted', booking_event_detail(old));
    return old;
  end if;
end $$;

drop trigger if exists bookings_events_ins on bookings;
drop trigger if exists bookings_events_upd on bookings;
drop trigger if exists bookings_events_del on bookings;
create trigger bookings_events_ins after insert on bookings for each row execute function trg_booking_events();
create trigger bookings_events_upd after update of status on bookings for each row execute function trg_booking_events();
create trigger bookings_events_del before delete on bookings for each row execute function trg_booking_events();
