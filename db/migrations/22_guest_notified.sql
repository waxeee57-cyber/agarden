-- 22_guest_notified — "did the guest actually get the letter?"
--
-- The site sends no mail: the owner opens a prefilled letter (mailto) and
-- sends it from their own mail app. The system cannot see that send, so the
-- owner marks it ("Elküldtem a levelet"). Until then a decided web booking
-- stays on the admin to-do list. Any later status change clears the mark,
-- because the guest then needs a new letter.

alter table bookings add column if not exists guest_notified_at timestamptz;

create or replace function trg_booking_notify_reset() returns trigger
language plpgsql as $$
begin
  if new.status is distinct from old.status then
    new.guest_notified_at := null;
  end if;
  return new;
end $$;

drop trigger if exists booking_notify_reset on bookings;
create trigger booking_notify_reset before update of status on bookings
  for each row execute function trg_booking_notify_reset();
