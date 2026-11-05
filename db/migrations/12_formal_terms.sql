-- 12_formal_terms — the one tegező phrase left after 11: the booking terms'
-- extra-cost note (shown in the booking flow). Exact-phrase replace only.
update listings
   set terms = replace(terms::text, 'többletköltséggel járhat: egyeztess velünk.', 'többletköltséggel járhat: kérjük, egyeztessen velünk.')::jsonb
 where terms::text like '%egyeztess velünk.%';
