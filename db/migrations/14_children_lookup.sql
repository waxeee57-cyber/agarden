-- 14_children_lookup — booking engine parity with the reference (Previo):
--  * children are counted separately from adults (IFA applies over 18 only)
--  * "Foglalásom": a guest can look up their own booking by the 8-character
--    code from the confirmation + their e-mail (index for the code prefix).
alter table bookings add column if not exists children_count int not null default 0;
do $$ begin
  alter table bookings add constraint bookings_children_nonneg check (children_count >= 0);
exception when duplicate_object then null; end $$;
create index if not exists bookings_code_idx on bookings (listing_id, (left(id::text, 8)));
