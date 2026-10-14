-- ============================================================
-- 05_production — two live sites (Garden + Napsugár).
--   * content columns on listings (site copy, rules, brand, geo)
--   * listing_photos (Vercel Blob URLs)
--   * rate_limits + rate_limit_hit() (DB-backed, shared across instances)
--   * haz-2 -> napsugar with REAL data (source: szallas.hu/napsugar-vendeghaz-velence,
--     read 2026-10-14). Both houses quote-only, surcharges inactive.
-- No invented data: unknown values stay NULL and are not rendered.
-- ============================================================

alter table listings add column if not exists site_name      text;
alter table listings add column if not exists tagline        text;
alter table listings add column if not exists content        jsonb not null default '{}'::jsonb;
alter table listings add column if not exists address        text;
alter table listings add column if not exists geo_lat        double precision;
alter table listings add column if not exists geo_lng        double precision;
alter table listings add column if not exists checkin_window text;
alter table listings add column if not exists checkout_time  text;
alter table listings add column if not exists house_rules    jsonb not null default '[]'::jsonb;
alter table listings add column if not exists brand          jsonb not null default '{}'::jsonb;

create table if not exists listing_photos (
  id          uuid primary key default gen_random_uuid(),
  listing_id  uuid not null references listings on delete cascade,
  blob_url    text not null,
  width       int not null,
  height      int not null,
  alt         text not null default '',
  sort_order  int not null default 0,
  is_cover    boolean not null default false,
  created_at  timestamptz default now()
);
create index if not exists listing_photos_listing_idx on listing_photos (listing_id, sort_order);
-- at most one cover per listing
create unique index if not exists listing_photos_one_cover on listing_photos (listing_id) where is_cover;

create table if not exists rate_limits (
  key          text primary key,
  window_start timestamptz not null,
  hits         int not null
);

-- Fixed-window counter, atomic via upsert. Returns true when the call is allowed.
create or replace function rate_limit_hit(p_key text, p_limit int, p_window_seconds int)
returns boolean
language plpgsql
as $$
declare
  v_hits int;
begin
  insert into rate_limits as r (key, window_start, hits)
  values (p_key, now(), 1)
  on conflict (key) do update
    set hits = case when r.window_start < now() - make_interval(secs => p_window_seconds) then 1 else r.hits + 1 end,
        window_start = case when r.window_start < now() - make_interval(secs => p_window_seconds) then now() else r.window_start end
  returning hits into v_hits;
  return v_hits <= p_limit;
end;
$$;

-- Inactive surcharge rows (amount 0) so the admin can switch them on with a real amount.
insert into listing_surcharges (listing_id, code, label, amount_huf, calc, active)
select l.id, s.code, s.label, 0, 'per_stay', false
from listings l
cross join (values
  ('single_night', '1 éjszakás felár'),
  ('pet',          'Kisállat (kistestű)'),
  ('event',        'Rendezvény / búcsú')
) as s(code, label)
where l.slug in ('velence', 'haz-2')
on conflict (listing_id, code) do nothing;

-- ------------------------------------------------------------
-- Garden Vendégház Velence
-- ------------------------------------------------------------
update listings set
  site_name = 'Garden Vendégház',
  tagline   = 'Egyben bérelhető vendégház 12 főre, jakuzzival és szaunával',
  address   = null,   -- no street address on record (owner TBD)
  geo_lat   = null,
  geo_lng   = null,
  checkin_window = null,
  checkout_time  = null,
  brand = '{"theme": "garden", "accent": "#CDA047", "deep": "#1E4339"}'::jsonb,
  house_rules = '[
    {"t": "Csak egyben bérelhető", "d": "A házat egészben adjuk ki, legfeljebb 10+2 főre."},
    {"t": "Minimum 2 éjszaka", "d": "1 éjszaka felár ellenében foglalható."},
    {"t": "Kisállat", "d": "Kistestű állat felár ellenében hozható."},
    {"t": "Rendezvény, búcsú", "d": "Eltérő árazás, előzetes egyeztetéssel."}
  ]'::jsonb,
  content = '{
    "eyebrow": "Velencei-tó · déli part",
    "lead": "Az egész ház a tiétek. Egyben bérelhető nyaraló legfeljebb 10+2 főnek, saját wellness sarokkal: baráti társaságnak, nagycsaládnak, közös hétvégékre.",
    "highlights": ["10+2 fő", "4 hálószoba", "jakuzzi és szauna", "min. 2 éj"],
    "intro_eyebrow": "Csak egyben bérelhető",
    "intro_title": "Egy ház. Egy társaság. Senki idegen.",
    "intro_body": "A Garden Vendégház kizárólag egyben bérelhető: a négy hálószoba, a közös terek és a wellness sarok mind a tiétek, a Velencei-tó déli partján.",
    "spaces_title": "Két szint, tíz embernek kényelmesen",
    "spaces": [
      {"tag": "Emelet", "title": "4 hálószoba, erkéllyel", "items": ["4 hálószoba", "Erkély", "Fürdőszoba és külön WC"]},
      {"tag": "Földszint", "title": "Nappali, konyha, fedett terasz", "items": ["Nappali-étkező kihúzható kanapéval", "Konyha", "Zuhanyzó és külön WC", "Fedett terasz wellness sarokkal"]}
    ],
    "wellness_eyebrow": "Wellness",
    "wellness_title": "A pihenés a fedett teraszon kezdődik",
    "wellness": [
      {"k": "6 fős", "t": "Jakuzzi", "d": "Pezsgőfürdő az egész társaságnak, a fedett terasz wellness sarkában."},
      {"k": "2 fős", "t": "Szauna", "d": "Kétszemélyes szauna a wellness sarokban."},
      {"k": "Fedett", "t": "Terasz", "d": "A wellness sarok fedett teraszon van."}
    ],
    "amenities_title": "Kert és praktikum",
    "amenities": [
      {"t": "Grill és bogrács", "d": "Közös főzéshez a kertben."},
      {"t": "Ingyenes parkolás", "d": "3 autó számára."},
      {"t": "Kisállat", "d": "Kistestű állat felár ellenében."},
      {"t": "Rendezvény, búcsú", "d": "Eltérő árazás: kérj ajánlatot az alkalomra."}
    ],
    "equipment": [],
    "kids": [],
    "contact_hours": "8–18 óra",
    "faq": [
      {"q": "Hány főt fogad a ház?", "a": "Legfeljebb 10 főt, plusz 2 főt pótágyon (kihúzható kanapé). A ház csak egyben bérelhető."},
      {"q": "Mennyi a minimális foglalási idő?", "a": "2 éjszaka. 1 éjszaka felár ellenében foglalható."},
      {"q": "Hozhatunk kutyát?", "a": "Kistestű állat felár ellenében hozható."},
      {"q": "Van parkolás?", "a": "Igen, ingyenes parkolás 3 autó számára."},
      {"q": "Legénybúcsúra, lánybúcsúra is kiadjátok?", "a": "Igen, rendezvényekre és búcsúkra eltérő árazással. Kérj ajánlatot a pontos részletekkel."},
      {"q": "Mikor kell fizetni?", "a": "Online nem vonunk le pénzt. A foglalást e-mailben visszaigazoljuk, a fizetés a helyszínen történik."}
    ],
    "seo": {
      "title": "Velencei-tó szállás 12 főre, jakuzzi, szauna | Garden",
      "description": "Egyben bérelhető vendégház 12 főre a Velencei-tó déli partján: 6 fős jakuzzi, 2 fős szauna, kert grillel. Legénybúcsú szállásnak is. Foglalj online."
    },
    "sister_pitch": "Nagyobb társaság? Garden: 10+2 fő, jakuzzi és szauna."
  }'::jsonb
where slug = 'velence';

-- ------------------------------------------------------------
-- Napsugár Vendégház Velence (was haz-2)
-- Coordinates: Nominatim (OSM way 290351518, "Balatoni út, Velencefürdő") —
-- street-level centroid, house number 4 is not in OSM. Identical to the
-- marker on szallas.hu/napsugar-vendeghaz-velence (47.217182, 18.649723).
-- ------------------------------------------------------------
update listings set
  slug = 'napsugar',
  name = 'Napsugár Vendégház Velence',
  site_name = 'Napsugár Vendégház',
  status = 'active',
  capacity_max = 6,
  capacity_extra = 2,
  min_nights = 2,
  ntak_id = 'MA26128139',
  contact_email = null,                -- no public e-mail (owner TBD)
  contact_phone = '+36 30 344 2000',
  nightly_rate_huf = null,
  pricing_mode = 'quote',
  sort_order = 1,
  tagline = 'Medencés, jakuzzis családi ház 8 főre a Velencei-tónál',
  address = '2481 Velence, Balatoni út 4.',
  geo_lat = 47.2171822,
  geo_lng = 18.6497229,
  checkin_window = '14:00–18:00',
  checkout_time = '10:00',
  brand = '{"theme": "napsugar", "accent": "#E8973A", "deep": "#22485A"}'::jsonb,
  house_rules = '[
    {"t": "Csak egyben bérelhető", "d": "A házban csak a foglalásban szereplő vendégek tartózkodhatnak."},
    {"t": "Érkezés 14:00–18:00", "d": "Ha később érkeztek, előre jelezzétek."},
    {"t": "Távozás 10:00-ig", "d": ""},
    {"t": "Minimum 2 éjszaka", "d": "1 éjszaka felár ellenében foglalható."},
    {"t": "Kisállat", "d": "Kistestű állat felár ellenében hozható."},
    {"t": "Csendes pihenés", "d": "A szokásostól eltérő hangoskodás nem megengedett."},
    {"t": "Legény- és lánybúcsú", "d": "Eltérő árazással, előzetes egyeztetéssel."},
    {"t": "Energiafelár", "d": "Fűtés és klíma használatakor fogyasztástól függően plusz energiadíj lehet."}
  ]'::jsonb,
  content = '{
    "eyebrow": "Velencei-tó · Balatoni út 4.",
    "lead": "Medence nyáron, jakuzzi egész évben, árnyas udvar grillel. Egyben bérelhető családi ház legfeljebb 6+2 főnek a Velencei-tó déli részén.",
    "highlights": ["6+2 fő", "2 hálószoba", "medence és jakuzzi", "min. 2 éj"],
    "intro_eyebrow": "Csak egyben bérelhető",
    "intro_title": "Kisebb csapatnak, saját udvarral.",
    "intro_body": "90 m² ház és 200 m² udvar: két hálószoba az emeleten, nappali és amerikai konyha a földszinten, kint medence, jakuzzi és grill. A házban csak a foglalásban szereplő vendégek tartózkodhatnak.",
    "spaces_title": "Két szint, 90 m², 200 m² udvar",
    "spaces": [
      {"tag": "Emelet", "title": "2 hálószoba, saját klímával", "items": ["Mindkét szobában 3 összetolható egyszemélyes ágy", "Szekrény mindkét szobában", "Szobánként saját fűtő-hűtő klíma"]},
      {"tag": "Földszint", "title": "Nappali, étkező, amerikai konyha", "items": ["Nappali kihúzható kanapéval (+2 fő)", "Étkező és amerikai konyha", "Fürdőszoba zuhanytálcával és mosógéppel, a WC a fürdőben", "Nyitott terasz"]}
    ],
    "wellness_eyebrow": "Medence és jakuzzi",
    "wellness_title": "Nyáron medence, télen is jakuzzi",
    "wellness": [
      {"k": "25–28 °C", "t": "Kültéri medence", "d": "Szezonálisan, 70–85 cm mély. Használata külön díjas lehet: egyeztessetek velünk."},
      {"k": "20–40 °C", "t": "Kültéri jakuzzi", "d": "Egész évben használható."}
    ],
    "amenities_title": "Udvar és praktikum",
    "amenities": [
      {"t": "Grill, bogrács, szalonnasütés", "d": "Az udvaron."},
      {"t": "Parkolás", "d": "3 zárt parkolóhely, mellette ingyenes utcai parkolás."},
      {"t": "Gyerekbarát", "d": "Etetőszék, bébiétel-melegítés, kiságy."},
      {"t": "Kisállat", "d": "Kistestű állat felár ellenében."}
    ],
    "equipment": ["Klíma", "Padlófűtés", "Wi-Fi", "Smart TV", "Mosógép", "Mosogatógép", "Mikrohullámú sütő", "Sütő és főzőlap", "Hűtő", "Hajszárító", "Kávé- és teafőző", "Edények"],
    "kids": ["Etetőszék", "Bébiétel-melegítés", "Kiságy"],
    "contact_hours": null,
    "faq": [
      {"q": "Hány főt fogad a ház?", "a": "Legfeljebb 6 főt, plusz 2 főt a nappali kihúzható kanapéján. A ház csak egyben bérelhető."},
      {"q": "Mennyi a minimális foglalási idő?", "a": "2 éjszaka. 1 éjszaka felár ellenében foglalható."},
      {"q": "Mikor lehet érkezni és távozni?", "a": "Érkezés 14:00 és 18:00 között (ha később érkeztek, jelezzétek előre), távozás 10:00-ig."},
      {"q": "Van kaució?", "a": "Igen, érkezéskor 80 000 Ft kauciót kérünk, amely károkozás hiányában maradéktalanul visszajár."},
      {"q": "Mennyi az idegenforgalmi adó?", "a": "18 éves kor felett 800 Ft / fő / éjszaka, a szálláshelyen fizetendő."},
      {"q": "Hogyan lehet fizetni?", "a": "Online nem vonunk le pénzt. A teljes összeget legkésőbb az érkezés napján kérjük, forintban vagy euróban."},
      {"q": "Hozhatunk kutyát?", "a": "Kistestű állat felár ellenében hozható."},
      {"q": "Van parkolás?", "a": "3 zárt parkolóhely, valamint ingyenes utcai parkolás."},
      {"q": "Használható a medence?", "a": "A kültéri medence szezonálisan üzemel (25–28 °C, 70–85 cm). Használata külön díjas lehet, erről egyeztessetek velünk. A jakuzzi egész évben használható."}
    ],
    "seo": {
      "title": "Medencés szállás Velence, jakuzzis ház 8 főre | Napsugár",
      "description": "Családi nyaraló a Velencei-tónál: egyben bérelhető ház 6+2 főre medencével, egész évben jakuzzival, udvarral és grillel. Foglalj vagy kérj ajánlatot."
    },
    "sister_pitch": "Kisebbek vagytok? Napsugár: 6+2 fő, medence és jakuzzi."
  }'::jsonb
where id = '33333333-3333-3333-3333-333333333333';
