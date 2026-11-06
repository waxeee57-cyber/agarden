-- 20_cash_on_site_ical_conflicts — request-based booking, cash on site.
--
-- 1. Payment model: nothing is paid before arrival. The deposit setting is
--    retired (code no longer reads or writes it); listings.bank_account is
--    no longer read anywhere and stays only so no owner data is destroyed.
-- 2. The seeded FAQ answer about paying (written by us in 09, not by the
--    owner) is rewritten only where it is still exactly the seeded text:
--    in listings.content.faq and in the GYIK document (as a new version, so
--    the owner can restore the old one). The owner's own verbatim texts
--    (Házirend, ÁSZF) are NOT touched — the admin flags them instead.
-- 3. iCal: a range from an external calendar that overlaps one of OUR
--    bookings (pending or confirmed) cannot be imported (exclusion
--    constraint). It used to be skipped silently; now each sync records it,
--    so the owner sees the clash before confirming the request.

update listings set terms = terms - 'deposit_pct' where terms ? 'deposit_pct';

update listings set content = jsonb_set(content, '{faq}', (
  select coalesce(jsonb_agg(case
    when f->>'a' = 'A foglalást 24 órán belül visszaigazoljuk. A megerősítéshez a szállásdíj 20%-át előlegként átutalással kérjük, ez 30 napon túli lemondásnál visszajár. A fennmaradó összeget, az idegenforgalmi adót és a kauciót érkezéskor, készpénzben vagy átutalással kell fizetni.'
    then jsonb_build_object('q', f->>'q', 'a', 'A foglalási kérelmet 24 órán belül e-mailben visszaigazoljuk. Előleget nem kérünk: a szállásdíjat, az idegenforgalmi adót és a kauciót érkezéskor, a helyszínen, készpénzben kell kiegyenlíteni.')
    else f end), '[]'::jsonb)
  from jsonb_array_elements(content->'faq') f))
where jsonb_typeof(content->'faq') = 'array';

select save_listing_document(d.listing_id, 'gyik', replace(d.body, 'A foglalást 24 órán belül visszaigazoljuk. A megerősítéshez a szállásdíj 20%-át előlegként átutalással kérjük, ez 30 napon túli lemondásnál visszajár. A fennmaradó összeget, az idegenforgalmi adót és a kauciót érkezéskor, készpénzben vagy átutalással kell fizetni.', 'A foglalási kérelmet 24 órán belül e-mailben visszaigazoljuk. Előleget nem kérünk: a szállásdíjat, az idegenforgalmi adót és a kauciót érkezéskor, a helyszínen, készpénzben kell kiegyenlíteni.'), d.effective_date)
  from listing_documents d
 where d.kind = 'gyik' and position('A foglalást 24 órán belül visszaigazoljuk. A megerősítéshez a szállásdíj 20%-át előlegként átutalással kérjük, ez 30 napon túli lemondásnál visszajár. A fennmaradó összeget, az idegenforgalmi adót és a kauciót érkezéskor, készpénzben vagy átutalással kell fizetni.' in d.body) > 0;

alter table ical_feeds add column if not exists conflicts jsonb not null default '[]'::jsonb;
