-- 23_copy_fixes — Hungarian copy audit (2026-11-18).
-- Only texts we seeded are changed, and only where still exactly as seeded;
-- the GYIK document is saved as a new version (restorable in the admin).

-- page titles: grammatical Hungarian
update listings set content = jsonb_set(content, '{seo,title}', '"Szállás a Velencei-tónál 12 főre, jakuzzival és szaunával | Garden"')
 where content #>> '{seo,title}' = 'Velencei-tó szállás 12 főre, jakuzzi, szauna | Garden';
update listings set content = jsonb_set(content, '{seo,title}', '"Medencés szállás Velencén, jakuzzis ház 8 főre | Napsugár"')
 where content #>> '{seo,title}' = 'Medencés szállás Velence, jakuzzis ház 8 főre | Napsugár';

-- payment answer: cash on site (the "online" wording implied a later online charge)
update listings set content = jsonb_set(content, '{faq}', (
  select coalesce(jsonb_agg(case
    when f->>'a' = 'Online nem vonunk le pénzt. A teljes összeget legkésőbb az érkezés napján kérjük, forintban vagy euróban.'
    then jsonb_build_object('q', f->>'q', 'a', 'Előleget nem kérünk: a teljes összeget érkezéskor, a helyszínen, készpénzben kell kiegyenlíteni, forintban vagy euróban.')
    else f end), '[]'::jsonb)
  from jsonb_array_elements(content->'faq') f))
where jsonb_typeof(content->'faq') = 'array';

select save_listing_document(d.listing_id, 'gyik',
  replace(d.body, 'Online nem vonunk le pénzt. A teljes összeget legkésőbb az érkezés napján kérjük, forintban vagy euróban.',
                  'Előleget nem kérünk: a teljes összeget érkezéskor, a helyszínen, készpénzben kell kiegyenlíteni, forintban vagy euróban.'),
  d.effective_date)
  from listing_documents d
 where d.kind = 'gyik' and position('Online nem vonunk le pénzt. A teljes összeget legkésőbb az érkezés napján kérjük, forintban vagy euróban.' in d.body) > 0;
