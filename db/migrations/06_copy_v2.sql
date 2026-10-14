-- ============================================================
-- 06_copy_v2 — repositioning: "the house is the destination".
-- The lake (record-low water level, 2026) is location context only, never
-- the promise. Facts unchanged; only wording + Garden's cover photo.
-- Runs once (applied_migrations); later admin edits are never overwritten.
-- ============================================================

update listings set
  content = content || jsonb_build_object(
    'lead', 'Egyben bérelhető ház 10+2 főre Velencén, a tó déli partján. Négy hálószoba, fedett terasz wellness sarokkal, kert bográccsal. Csak a ti társaságotok.',
    'sister_pitch', 'Nagyobb társaság? A Garden 10+2 főt fogad, jakuzzival és szaunával.'
  )
where slug = 'velence';

update listings set
  content = content || jsonb_build_object(
    'lead', 'Egyben bérelhető családi ház 6+2 főre Velencén. Két hálószoba saját klímával, amerikai konyha, 200 m² udvar grillel és bográccsal.',
    'sister_pitch', 'Kisebbek vagytok? A Napsugár 6+2 főre szól, medencével és egész évben jakuzzival.'
  )
where slug = 'napsugar';

-- Garden's identity is the evening wellness corner: its night jacuzzi photo becomes the cover.
-- Two steps (the one-cover partial unique index is checked per row), both
-- guarded so nothing changes if that photo is missing. Same transaction (migrate.mjs).
update listing_photos p set is_cover = false
from listings l
where l.id = p.listing_id and l.slug = 'velence' and p.is_cover
  and exists (select 1 from listing_photos q where q.listing_id = l.id and q.alt = 'Jakuzzi este a fedett teraszon');
update listing_photos p set is_cover = true
from listings l
where l.id = p.listing_id and l.slug = 'velence' and p.alt = 'Jakuzzi este a fedett teraszon';
