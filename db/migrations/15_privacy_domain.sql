-- 15_privacy_domain — the owner's privacy notice (imported from the old
-- Webnode site) still names the old address as "the site with the booking
-- form". Point it at the website itself, domain-neutral (the domain will
-- change). Exact-phrase replace, saved as a restorable version in the admin.
do $$
declare d record;
begin
  for d in select listing_id, kind, body, effective_date from listing_documents
            where body like '%A www.gardenvendeghazvelence.webnode.hu oldalon egy űrlap található%' loop
    perform save_listing_document(
      d.listing_id, d.kind,
      replace(d.body, 'A www.gardenvendeghazvelence.webnode.hu oldalon egy űrlap található', 'Honlapunkon egy foglalási űrlap található'),
      d.effective_date);
  end loop;
end $$;
