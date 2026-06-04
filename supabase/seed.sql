-- ============================================================
-- seed.sql — runs after migrations on every `supabase db reset`.
--
-- Fixed UUIDs so tests and later slices can reference rows deterministically.
-- Velence carries REAL data from the brief; its price is an explicit DEMO
-- placeholder (this business is quote-based, there is no public nightly rate).
-- Listings #2/#3 are placeholders — NO invented data (capacity / NTAK / price
-- stay NULL until the owner provides them).
-- ============================================================

-- Owner tenant
insert into tenants (id, name) values
  ('11111111-1111-1111-1111-111111111111', 'Garden Vendeghaz')
on conflict (id) do nothing;

-- ------------------------------------------------------------
-- Velence — active, real data, DEMO price.
-- ------------------------------------------------------------
insert into listings (
  id, tenant_id, slug, name, status, rental_mode,
  capacity_max, capacity_extra, min_nights,
  ntak_id, contact_email, contact_phone,
  nightly_rate_huf, pricing_mode, sort_order, description
) values (
  '22222222-2222-2222-2222-222222222222',
  '11111111-1111-1111-1111-111111111111',
  'velence',
  'Garden Vendeghaz Velence',
  'active',
  'whole_unit',
  10, 2, 2,
  'MA22041986',
  'gardenvendeghazvelence@gmail.com',
  '+36 20 497 1994',
  75000, 'demo', 0,
  '[DEMO AR — ez NEM a valos nyilvanos ar; a foglalas ajanlatkeres-alapu.] '
  'Velencei-to deli part, egyben (whole_unit) berelheto haz. Emelet: 4 szoba + erkely + furdo + wc. '
  'Foldszint: nappali-etkezo kihuzhato kanappal, zuhanyzo + wc, konyha, fedett terasz wellness sarokkal. '
  '6 fos jakuzzi, 2 fos szauna. Kert: grill + bogracs. Ingyenes parkolas 3 autora. '
  'Allatbarat (kistestu, felarral).'
)
on conflict (id) do nothing;

-- Velence surcharges (DEMO amounts)
insert into listing_surcharges (listing_id, code, label, amount_huf, calc, active) values
  ('22222222-2222-2222-2222-222222222222', 'single_night', '1 ejszakas felar',        15000, 'per_stay', true),
  ('22222222-2222-2222-2222-222222222222', 'pet',          'Kisallat (kistestu)',       8000, 'per_stay', true),
  ('22222222-2222-2222-2222-222222222222', 'event',        'Rendezveny/bucsu',         50000, 'per_stay', true)
on conflict (listing_id, code) do nothing;

-- A couple of external blocks so the availability lock is demonstrable.
insert into occupancy (listing_id, during, kind, note) values
  ('22222222-2222-2222-2222-222222222222', daterange('2026-07-10', '2026-07-15', '[)'), 'external', 'iCal import (demo)'),
  ('22222222-2222-2222-2222-222222222222', daterange('2026-08-01', '2026-08-05', '[)'), 'external', 'iCal import (demo)')
on conflict do nothing;

-- ------------------------------------------------------------
-- Listings #2 / #3 — placeholders. TBD/NULL on purpose.
-- ------------------------------------------------------------
insert into listings (
  id, tenant_id, slug, name, status, rental_mode,
  capacity_max, min_nights, ntak_id, nightly_rate_huf, pricing_mode, sort_order, description
) values
  ('33333333-3333-3333-3333-333333333333', '11111111-1111-1111-1111-111111111111',
   'haz-2', 'Vendeghaz #2 (TBD)', 'placeholder', 'whole_unit',
   null, 2, null, null, 'quote', 1, 'Hamarosan — reszletek megadasra varnak (TBD).'),
  ('44444444-4444-4444-4444-444444444444', '11111111-1111-1111-1111-111111111111',
   'haz-3', 'Vendeghaz #3 (TBD)', 'placeholder', 'whole_unit',
   null, 2, null, null, 'quote', 2, 'Hamarosan — reszletek megadasra varnak (TBD).')
on conflict (id) do nothing;
