-- ============================================================
-- 04_seed_base — tenant + listing rows (ported from supabase/seed.sql).
-- Fixed UUIDs keep tests and scripts deterministic.
-- PRODUCTION RULE: the old DEMO price (75 000 Ft), DEMO surcharges and DEMO
-- occupancy are NOT carried over. Every listing starts quote-only; the owner
-- sets real prices in /admin. Surcharge rows exist but are inactive (amount 0).
-- ============================================================

insert into tenants (id, name) values
  ('11111111-1111-1111-1111-111111111111', 'Garden Vendeghaz')
on conflict (id) do nothing;

-- Garden Vendégház Velence — real data from the owner brief.
insert into listings (
  id, tenant_id, slug, name, status, rental_mode,
  capacity_max, capacity_extra, min_nights, ntak_id, contact_email, contact_phone,
  nightly_rate_huf, pricing_mode, sort_order
) values (
  '22222222-2222-2222-2222-222222222222', '11111111-1111-1111-1111-111111111111',
  'velence', 'Garden Vendégház Velence', 'active', 'whole_unit',
  10, 2, 2, 'MA22041986', 'gardenvendeghazvelence@gmail.com', '+36 20 497 1994',
  null, 'quote', 0
)
on conflict (id) do nothing;

-- #2 becomes Napsugár in 05_production. #3 stays a hidden placeholder.
insert into listings (id, tenant_id, slug, name, status, rental_mode, capacity_max, min_nights, pricing_mode, sort_order) values
  ('33333333-3333-3333-3333-333333333333', '11111111-1111-1111-1111-111111111111', 'haz-2', 'Vendeghaz #2 (TBD)', 'placeholder', 'whole_unit', null, 2, 'quote', 1),
  ('44444444-4444-4444-4444-444444444444', '11111111-1111-1111-1111-111111111111', 'haz-3', 'Vendeghaz #3 (TBD)', 'placeholder', 'whole_unit', null, 2, 'quote', 2)
on conflict (id) do nothing;
