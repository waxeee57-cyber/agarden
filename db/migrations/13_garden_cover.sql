-- 13_garden_cover — the Garden hero used a 900×1200 portrait night shot,
-- stretched to ~1320 px wide on desktop: visibly soft ("low budget").
-- Switch the cover to the sharp landscape daytime shot of the covered
-- wellness terrace — only if the owner has not picked a cover since.
update listing_photos p set is_cover = (p.blob_url like '%/61403b6f-3c79-4e9c-b8ba-7136063d364f.webp')
  from listings l
 where l.id = p.listing_id and l.slug = 'velence'
   and exists (select 1 from listing_photos c where c.listing_id = l.id and c.is_cover and c.blob_url like '%/3e04f7ba-1995-4aa8-b2cf-9a6074515e25.webp')
   and exists (select 1 from listing_photos n where n.listing_id = l.id and n.blob_url like '%/61403b6f-3c79-4e9c-b8ba-7136063d364f.webp');
