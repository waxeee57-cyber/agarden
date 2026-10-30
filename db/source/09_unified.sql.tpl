-- ============================================================
-- 09_unified — owner consultation of 2026-10-30.
--
--   * listings: bedrooms / bathrooms / open_all_year, social links, menu
--     toggles (settings), booking terms (terms), bank_account.
--     bank_account is PRIVATE: only lib/email reads it (confirmation e-mail);
--     lib/listing.ts never selects it, so no public page can render it.
--   * listing_documents (+ last-20 version history): házirend, ÁSZF, GYIK,
--     Környék, adatkezelés — markdown-lite, edited from the admin.
--   * listing_photos: category + 3 featured slots.
--   * contact_messages: the Kapcsolat form is stored first (nothing is lost
--     while e-mail is off), pruned after 90 days.
--   * Garden facts from the owner + gardenvendeghazvelence.webnode.hu
--     (captured verbatim 2026-10-30 in db/source/garden-webnode/).
--     Coordinates: Nominatim, OSM way 24713301 "Szabolcsi út" — street-level
--     centroid; house number 83/B is not in OSM.
-- Runs once (applied_migrations); later admin edits are never overwritten.
-- ============================================================

alter table listings add column if not exists bedrooms      smallint;
alter table listings add column if not exists bathrooms     smallint;
alter table listings add column if not exists open_all_year boolean;
alter table listings add column if not exists social        jsonb not null default '{}'::jsonb;
alter table listings add column if not exists settings      jsonb not null default '{}'::jsonb;
alter table listings add column if not exists terms         jsonb not null default '{}'::jsonb;
alter table listings add column if not exists bank_account  text;

-- ---------- photos ----------
alter table listing_photos add column if not exists category text not null default 'egyeb';
alter table listing_photos add column if not exists featured smallint;
do $$ begin
  alter table listing_photos add constraint listing_photos_category_chk
    check (category in ('wellness', 'kert', 'nappali', 'haloszoba', 'furdo', 'kornyek', 'egyeb'));
exception when duplicate_object then null; end $$;
do $$ begin
  alter table listing_photos add constraint listing_photos_featured_chk check (featured between 1 and 3);
exception when duplicate_object then null; end $$;
create unique index if not exists listing_photos_one_featured on listing_photos (listing_id, featured) where featured is not null;

-- ---------- documents + versions ----------
create table if not exists listing_documents (
  listing_id     uuid not null references listings on delete cascade,
  kind           text not null check (kind in ('hazirend', 'aszf', 'gyik', 'kornyek', 'adatvedelem')),
  body           text not null default '',
  effective_date date,
  updated_at     timestamptz not null default now(),
  primary key (listing_id, kind)
);

create table if not exists listing_document_versions (
  id             uuid primary key default gen_random_uuid(),
  listing_id     uuid not null references listings on delete cascade,
  kind           text not null,
  body           text not null,
  effective_date date,
  created_at     timestamptz not null default clock_timestamp()
);
create index if not exists listing_document_versions_idx on listing_document_versions (listing_id, kind, created_at desc);

-- Save = upsert the live document + snapshot it as a version; keep the newest 20.
-- Restore = save(version.body), so a restore is itself undoable.
create or replace function save_listing_document(p_listing uuid, p_kind text, p_body text, p_effective date)
returns jsonb language plpgsql as $$
declare v_id uuid;
begin
  insert into listing_documents (listing_id, kind, body, effective_date, updated_at)
  values (p_listing, p_kind, p_body, p_effective, now())
  on conflict (listing_id, kind) do update
    set body = excluded.body, effective_date = excluded.effective_date, updated_at = now();
  insert into listing_document_versions (listing_id, kind, body, effective_date)
  values (p_listing, p_kind, p_body, p_effective) returning id into v_id;
  delete from listing_document_versions
   where listing_id = p_listing and kind = p_kind
     and id not in (select id from listing_document_versions
                     where listing_id = p_listing and kind = p_kind
                     order by created_at desc limit 20);
  return jsonb_build_object('ok', true, 'version_id', v_id);
end $$;

-- ---------- contact messages ----------
create table if not exists contact_messages (
  id         uuid primary key default gen_random_uuid(),
  listing_id uuid not null references listings on delete cascade,
  name       text not null,
  email      text not null,
  phone      text,
  message    text not null,
  handled    boolean not null default false,
  created_at timestamptz not null default now()
);
create index if not exists contact_messages_listing_idx on contact_messages (listing_id, created_at desc);

create or replace function add_contact_message(p_listing uuid, p_name text, p_email text, p_phone text, p_message text)
returns uuid language plpgsql as $$
declare v_id uuid;
begin
  delete from contact_messages where created_at < now() - interval '90 days';
  insert into contact_messages (listing_id, name, email, phone, message)
  values (p_listing, p_name, p_email, nullif(p_phone, ''), p_message) returning id into v_id;
  return v_id;
end $$;

-- ============================================================
-- Garden Vendégház Velence
-- ============================================================
update listings set
  address        = '2481 Velence, Szabolcsi út 83/B.',
  geo_lat        = 47.2240273,
  geo_lng        = 18.6693229,
  bedrooms       = 4,
  bathrooms      = 2,
  open_all_year  = true,
  checkin_window = '14:00-tól',
  checkout_time  = '10:00',
  social   = '{"facebook": "https://www.facebook.com/gardenvendeghazvelence/", "instagram": "https://www.instagram.com/garden_vendeghaz_velence/"}'::jsonb,
  settings = '{"menu_gyik": true, "menu_kornyek": true}'::jsonb,
  terms    = '{"confirm_hours": 24, "deposit_pct": 20, "cancel_days": 30, "quote_valid_days": 4,
               "extra_costs": ["Fűtés és klíma használatakor fogyasztástól függően energiadíj kerülhet felszámításra.", "A jakuzzi és a szauna használata esetenként többletköltséggel járhat: egyeztess velünk."]}'::jsonb,
  content  = jsonb_set(content, '{faq}', (
    select coalesce(jsonb_agg(case when f->>'q' = 'Mikor kell fizetni?'
      then jsonb_build_object('q', f->>'q', 'a', 'A foglalást 24 órán belül visszaigazoljuk. A megerősítéshez a szállásdíj 20%-át előlegként átutalással kérjük, ez 30 napon túli lemondásnál visszajár. A fennmaradó összeget, az idegenforgalmi adót és a kauciót érkezéskor, készpénzben vagy átutalással kell fizetni.')
      else f end), '[]'::jsonb)
    from jsonb_array_elements(content->'faq') f))
where slug = 'velence';

-- ============================================================
-- Napsugár Vendégház Velence (szallas.hu facts already in 05)
-- ============================================================
update listings set
  bedrooms  = 2,
  bathrooms = 1,
  social    = '{"facebook": "https://facebook.com/napsugarvendeghazvelence"}'::jsonb,
  settings  = '{"menu_gyik": true, "menu_kornyek": true}'::jsonb,
  terms     = '{"extra_costs": ["A medence használata külön díjas lehet.", "Fűtés és klíma használatakor fogyasztástól függően energiadíj kerülhet felszámításra."]}'::jsonb
where slug = 'napsugar';

-- ---------- homepage blocks (facts already published by the owner / szallas.hu) ----------
update listings set content = content || jsonb_build_object(
  'hero_chips', jsonb_build_array('10+2 fő', '4 hálószoba, 2 fürdő', 'Jakuzzi és szauna', 'Egész évben nyitva'),
  'why', jsonb_build_array(
    jsonb_build_object('t', 'Az egész ház a tiétek', 'd', 'Kizárólag egyben bérelhető: négy hálószoba, két fürdőszoba és a közös terek csak a ti társaságotoké.'),
    jsonb_build_object('t', 'Wellness a fedett teraszon', 'd', '6 személyes jakuzzi és 2 személyes szauna a fedett terasz wellness sarkában.'),
    jsonb_build_object('t', 'Kert grillel és bográccsal', 'd', 'Bekerített kert grillezési és bográcsozási lehetőséggel, ingyenes parkolás 3 autónak.')))
where slug = 'velence';
update listings set content = content || jsonb_build_object(
  'hero_chips', jsonb_build_array('6+2 fő', '2 hálószoba', 'Medence és jakuzzi', '200 m² udvar'),
  'why', jsonb_build_array(
    jsonb_build_object('t', 'Nyáron medence, egész évben jakuzzi', 'd', 'Szezonális kültéri medence (25–28 °C) és egész évben használható kültéri jakuzzi.'),
    jsonb_build_object('t', 'Saját udvar a társaságnak', 'd', '200 m² udvar grillel, bográccsal és szalonnasütővel, 3 zárt parkolóhely.'),
    jsonb_build_object('t', 'Gyerekkel is kényelmes', 'd', 'Etetőszék, kiságy, bébiétel-melegítés, és mindkét hálószobában saját klíma.')))
where slug = 'napsugar';

-- ---------- documents: Garden (verbatim webnode) ----------
select save_listing_document(id, 'hazirend', $md$
{{hazirend}}$md$, null) from listings where slug = 'velence';

select save_listing_document(id, 'aszf', $md$
{{aszf}}$md$, '2015-08-17') from listings where slug = 'velence';

select save_listing_document(id, 'adatvedelem', $md$
{{adatvedelem}}$md$, null) from listings where slug = 'velence';

select save_listing_document(id, 'kornyek', $md$
{{kornyek}}$md$, null) from listings where slug = 'velence';

-- ---------- documents: both houses' FAQ and Napsugár's rules, from the existing columns ----------
select save_listing_document(l.id, 'gyik',
  (select string_agg('## ' || (f->>'q') || chr(10) || (f->>'a'), chr(10) || chr(10)) from jsonb_array_elements(l.content->'faq') f), null)
  from listings l where l.slug in ('velence', 'napsugar') and jsonb_array_length(coalesce(l.content->'faq', '[]'::jsonb)) > 0;

select save_listing_document(l.id, 'hazirend',
  (select string_agg('## ' || (r->>'t') || case when coalesce(r->>'d', '') <> '' then chr(10) || (r->>'d') else '' end, chr(10) || chr(10))
     from jsonb_array_elements(l.house_rules) r), null)
  from listings l where l.slug = 'napsugar' and jsonb_array_length(l.house_rules) > 0;

-- ---------- Napsugár photo categories (from the alt texts set in 05) ----------
update listing_photos p set category = case
    when p.alt ~* 'jakuzzi|medencével' and p.alt !~* 'bogrács' then 'wellness'
    when p.alt ~* 'fürdőszoba' then 'furdo'
    when p.alt ~* 'hálószoba|ágy|lépcső' then 'haloszoba'
    when p.alt ~* 'nappali|konyha|étkező' then 'nappali'
    when p.alt ~* 'udvar|kert|tűzrakó|bogrács|asztalok' then 'kert'
    else 'egyeb' end
  from listings l where l.id = p.listing_id and l.slug = 'napsugar';

update listing_photos p set featured = f.slot
  from listings l, (values ('Nappali sarokkanapéval és tévével', 1), ('Hálószoba egyszemélyes ágyakkal és nagy szekrénnyel', 2), ('Kültéri jakuzzi a fedett, fa burkolatú teraszon', 3)) as f(alt, slot)
 where l.id = p.listing_id and l.slug = 'napsugar' and p.alt = f.alt;
