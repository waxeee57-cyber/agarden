-- ============================================================
-- 11_formal_copy — magázó hangnem (2026-11-04).
-- The owner picked velenceviolavilla.hu as the structural and content model;
-- it (like the owner's own webnode pages) addresses guests formally ("Ön").
-- Every seeded tegező phrase is rewritten. Only exact seeded phrases are
-- replaced, so anything the owner already rewrote in the admin stays as is.
-- Documents go through save_listing_document, so the change is a restorable
-- version in the admin.
-- ============================================================

create temporary table _formal (old text not null, new text not null, ord int not null) on commit drop;
insert into _formal (ord, old, new) values
  -- whole-sentence rewrites first (longest match wins)
  (1,  'Egyben bérelhető ház 10+2 főre Velencén, a tó déli partján. Négy hálószoba, fedett terasz wellness sarokkal, kert bográccsal. Csak a ti társaságotok.',
       'Várjuk szeretettel Velencén, a tó déli partján, jakuzzis, szaunás vendégházunkban. A ház kizárólag egyben bérelhető, legfeljebb 10+2 fő részére.'),
  (2,  'Az egész ház a tiétek. Egyben bérelhető nyaraló legfeljebb 10+2 főnek, saját wellness sarokkal: baráti társaságnak, nagycsaládnak, közös hétvégékre.',
       'Várjuk szeretettel Velencén, a tó déli partján, jakuzzis, szaunás vendégházunkban. A ház kizárólag egyben bérelhető, legfeljebb 10+2 fő részére.'),
  (3,  'Egyben bérelhető családi ház 6+2 főre Velencén. Két hálószoba saját klímával, amerikai konyha, 200 m² udvar grillel és bográccsal.',
       'Várjuk szeretettel Velencén medencés, jakuzzis családi házunkban. A ház kizárólag egyben bérelhető, legfeljebb 6+2 fő részére.'),
  (4,  'a négy hálószoba, a közös terek és a wellness sarok mind a tiétek,',
       'a négy hálószoba, a közös terek és a wellness sarok csak az Önök társaságáé,'),
  (5,  'négy hálószoba, két fürdőszoba és a közös terek csak a ti társaságotoké.',
       'négy hálószoba, két fürdőszoba és a közös terek csak az Önök társaságáé.'),
  (6,  'Az egész ház a tiétek', 'Az egész ház az Önöké'),
  (7,  'Kisebbek vagytok? A Napsugár 6+2 főre szól,', 'Kisebb társasággal érkeznek? A Napsugár 6+2 főre szól,'),
  (8,  'Kisebbek vagytok?', 'Kisebb társasággal érkeznek?'),
  (9,  'Ha később érkeztek, jelezzétek előre.', 'Későbbi érkezését kérjük, előre jelezze.'),
  (10, 'Ha később érkeztek, előre jelezzétek.', 'Későbbi érkezését kérjük, előre jelezze.'),
  (11, '(ha később érkeztek, jelezzétek előre)', '(későbbi érkezését kérjük, előre jelezze)'),
  (12, ', erről egyeztessetek velünk.', ', erről kérjük, egyeztessen velünk.'),
  (13, ': egyeztessetek velünk.', ': kérjük, egyeztessen velünk.'),
  (14, 'kérjük, legkésőbb 3 nappal érkezés előtt jelezd.', 'kérjük, legkésőbb 3 nappal érkezés előtt jelezze.'),
  (15, 'Eltérő árazás: kérj ajánlatot az alkalomra.', 'Eltérő árazás: kérjen ajánlatot az alkalomra.'),
  (16, 'Kérj ajánlatot a pontos részletekkel.', 'Kérjen ajánlatot a pontos részletekkel.'),
  (17, 'Legénybúcsúra, lánybúcsúra is kiadjátok?', 'Legénybúcsúra, lánybúcsúra is kiadják?'),
  (18, 'Foglalj vagy kérj ajánlatot.', 'Foglaljon vagy kérjen ajánlatot.'),
  (19, 'Foglalj online.', 'Foglaljon online.');

-- listings: content, house_rules, tagline
do $$
declare r record;
begin
  for r in select old, new from _formal order by ord loop
    update listings
       set content     = replace(content::text, r.old, r.new)::jsonb,
           house_rules = replace(house_rules::text, r.old, r.new)::jsonb,
           tagline     = replace(tagline, r.old, r.new)
     where content::text like '%' || r.old || '%'
        or house_rules::text like '%' || r.old || '%'
        or tagline like '%' || r.old || '%';
  end loop;
end $$;

-- owner documents (GYIK, házirend, Környék …): new restorable version only if changed
do $$
declare d record; v text; r record;
begin
  for d in select listing_id, kind, body, effective_date from listing_documents loop
    v := d.body;
    for r in select old, new from _formal order by ord loop
      v := replace(v, r.old, r.new);
    end loop;
    if v is distinct from d.body then
      perform save_listing_document(d.listing_id, d.kind, v, d.effective_date);
    end if;
  end loop;
end $$;
