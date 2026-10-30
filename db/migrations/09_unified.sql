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
select save_listing_document(id, 'hazirend', $md$Kérjük, figyelmesen olvassa el!

Házirendünk célja, hogy Vendégeinknek nyugodt, kellemes pihenést biztosítsunk, valamint elkerüljük az esetleges félreértéseket.

Mi azon fáradozunk, hogy Önök pihenésük ideje alatt jól érezzék magukat náluk. Mindent megteszünk annak érdekében, hogy semmilyen körülmény ne zavarja nyugalmukat. Ha ezen törekvésünk ellenére bármi zavaró tényezőt észlelnek, amivel nincsenek megelégedve, kérjük, haladéktalanul forduljanak a Szállásadóhoz. A szálláshely és a berendezési tárgyak állagának, rendjének, tisztaságának fenntartása érdekében kérjük, tartózkodjanak minden olyan tevékenységtől, amelyet saját otthonukban sem tennének.

## Szállásfoglalás

A szállásfoglalás e-mailen vagy telefonon keresztül történik.

## Bejelentkezés / Kijelentkezés

A szállást az érkezés napján 14:00-tól lehet elfoglalni. Az utolsó lefoglalt éjszaka után délelőtt 10:00-ig kérjük elhagyni a vendégház területét. Amennyiben 10 óráig a Vendég nem jelentkezik ki, automatikusan felszámoljuk a következő napi szállásdíjat.

A szálláson kizárólag csak azok a személyek, vendégek tartózkodhatnak, akikre a foglalás vonatkozik. Ellenkező esetben a keletkezett felár a kaucióból kerül levonásra.

Van lehetőség a szállás korábbi időpontban való elfoglalásához, illetve a távozás napján tovább maradáshoz. Mindkét esetben előzetes egyeztetésre van szükség.

A szállásadó jogosult - előzetes bejelentés nélkül - ellenőrizni, hogy a szálláshelyen az előre bejelentett, illetve kifizetett létszámban tartózkodnak-e a vendégek. Az ellenőrzés nem járhat a vendég zaklatásával és túlzott ellenőrzésével.

Igény esetén a tulajdonos/üzemeltető a megadott érkezési, illetve elutazási időpontban jelen van.

Érkezéskor a Vendég köteles a Szállásadónak átadni a személyes dokumentumait (útlevél vagy személyi igazolvány és lakcímkártya) és a helyszínen fizetendő összeget, illetve a kauciót.

## Szállás

A szállás igénybevétele előtt magától értetődik, hogy a Vendég ismeri a házirendet, és beleegyezik a követelményekbe és feltételekbe az itt leírtaknak megfelelően. Minden reklamációt akkor veszünk figyelembe, ha azok a tartózkodás ideje alatt vannak jelentve. Utólagos reklamációt nem fogadunk el.

Legkisebb vendégeink kényelme érdekében kérésre díjmentesen biztosítunk babaágyat. Kérjük, hogy ezen irányú igényüket foglalás során, de legkésőbb érkezés előtt min. 3 nappal jelezni.

Kérjük Önöket az éjszakai csend betartására 22:00 órától 6:00 óráig! Az esti órákba a vendégházban és a kertben kerülni szíveskedjenek az esetleges hangos, zavaró tevékenységeket.

A tartózkodási idő alatt az általánostól eltérő hangoskodás nem megengedett.

Távozáskor és éjszakára kérjük a ház bejáratát kulcsra zárni!

Napközben, ha elhagyják a vendégház területét, kérjük, az ablakokat és az ajtókat szíveskedjenek bezárni. Ez az esetleges esőzések során befolyó víz elkerülése végett szükséges, illetve hogy illetéktelen személyek ne juthassanak be.

## Fizetés

A foglalás megerősítéséhez 20% előleg utalás szükséges, mely 30 napon túli lemondás esetén jár vissza.

A szállásdíj fennmaradó része, az idegenforgalmi adó és a kaució fizetése a megérkezéskor történik készpénzben vagy átutalás formájába.

A kaució teljes összegben visszajár, ha nem történik károkozás és a vendégház rendezett állapotban kerül visszaadásra.

Fűtés és a klíma használata során fogyasztástól függően plusz energia díj kerülhet felszámolásra a foglalás összértékén felül.

A jakuzzi és a szauna használata esetenként többlet költséget jelenthet. Ezzel kapcsolatban kérem egyeztessen a szállásadóval.

## Felelősségvállalás

Az vendégház nem rendeltetésszerű használatából, illetve a házirend megszegéséből származó károkért a Vendégek anyagi felelősséggel tartoznak. Vendégeink által keletkezett károk rendezése a helyszínen történik.

A Szállásadó semmilyen felelősséget nem vállal, és kártérítés megfizetésére nem kötelezhető természeti csapás, tűz, illetve önhibáján kívül történt eseményekből eredő károkért. (pl. áramszünet, gázkimaradás).

A Szállásadónak jogában áll azonnali hatállyal a vendégházból eltávolítani, vagy nem fogadni azt a Vendéget, aki nem tartja be a rendszabályzatot, vagy viselkedése zavaró mások számára.

A házirend megsértése esetén, a szállás lemondásra kerülhet. Ebben az esetben a vendégnek nem áll módunkban visszafizetni az esetlegesen fennmaradó napokat.

A Vendégek felelősek a szálláshely tisztaságáért, valamint ezt a tisztaságot kötelesek megőrizni. A Szállásadó nem köteles a Vendég tartózkodása alatt a szállást takarítani, sem a szemétkosarat kiüríteni.

Minden Vendég után megtörténik az ágyneműk, törölközők, stb. cseréje, hosszabb tartózkodás alatt 7 naponta vagy kérésre, megegyezés szerint történik. A Szállásadó nem köteles azonban a Vendégeknek a kihelyezetteken kívül további kéztörlőt, törölközőt, konyhai törlőket, toalettpapírt biztosítani. Ezen felszereléseket az apartmanból kivinni tilos.

A Szállásadó nem felelős a Vendégek szabadidejének megtervezéséért sem az animálásért.

A Vendégek az apartmanban elhelyezett és ott hagyott értéktárgyaikért felelősséget nem vállalunk!

A Szállásadónak nincs joga a Vendég távollétében belépni annak szálláshelyére. Kivételt képeznek azok az esetek, melyekben elkerülhetetlen a Szállásadó belépése biztonsági okok vagy anyagi károk elkerülése miatt. Ebben az esetben köteles erről a Vendéget a következő találkozásnál értesíteni. Amennyiben a Szállásadó gyanítja, hogy a berendezésben kár keletkezett, a Vendég köteles beengedni a Szállásadót a szállásra, hogy ellenőrizze a helyzetet.

## Dohányzás

A dohányzás és a nyílt láng használata a házban szigorúan TILOS! Dohányzásra a ház bejárata előtt, erkélyen vagy a kertben van lehetőség. Szíveskedjenek a dohányzást ezekre a helyekre korlátozni, csikkeket ne szórják el, hanem azokat összegyűjtve a szemetesekbe helyezzék.

Amennyiben a be nem tartott jogszabály miatt intézkedés történik a Szállásadóval szemben úgy annak költségét a jogsértő köteles megtéríteni.

## Tűzrakás, bográcsozás

Tüzet rakni a kijelölt tűzrakó helyen lehet a mindenkori tűzvédelmi szabályok betartásával! (Tűz mellett oltóanyag elhelyezése, gyúlékony anyagok tűz mellől eltávolítva.) Mielőtt otthagynák a tűzrakó helyet, kérjük győződjenek meg róla, hogy a tüzet valóban eloltották! Olaj, petróleum vagy benzin használata TILOS!

## Háziállatok

A vendégházba kistestű háziállat behozható egyeztetés követően! Kérjük, ügyeljenek arra, hogy a házban, illetve az udvaron hagyott állatok a növényekben, kertben, bútorokban, stb. ne tegyenek kárt!

## Parkolás

Parkolásra a zárt udvarban, illetve a ház előtt van lehetőség. Kérjük, hogy autóikkal a ház előtt úgy parkoljanak le, hogy azzal más lakókat ne korlátozzanak a szabad mozgásban/parkolásban! A parkolókban elhelyezett gépkocsikban esetlegesen bekövetkezett károkért felelősséget nem vállalunk!

## Elektromos autó töltése

Az elektromos áramot kizárólag háztartási céllal lehet igénybe venni. Az elektromos autó töltése a hálózat kialakítása miatt TILOS! Az ebből eredő károkért teljes mértékben a kárt okozó Vendéget terheli az anyagi felelősség.

## Berendezési tárgyak és a kert használata

Kérjük a berendezési tárgyak rendeltetésszerű használatát! A dekorációs célt szolgáló használati tárgyakat, képeket, kérjük, ne vegyék el a helyükről. A benti berendezési és használati tárgyakat (ágy, ágynemű, matrac, TV, stb.) a szállásról kivinni TILOS! Távozáskor kérjük, győződjön meg, hogy a klíma, villanyok le vannak kapcsolva, illetve a vízcsapok el vannak zárva. A bútorokat átrendezni kizárólag a Szállásadó beleegyezésével lehet. Tisztelettel megkérjük Önöket, hogy a falfelületre ne kenjék fel a rovarokat. Kérjük, ügyeljenek a kerthelyiség és a növények épségére. Az apartman jól felszerelt konyhával rendelkezik, kérjük étkezésre ezt a helyiséget használni. A mikrohullámú sütőbe ne tegyenek be fémet tartalmazó tárgyat!

## A jakuzzi használatának szabályzata

1. A jakuzzi nem fürdésre, hanem lazításra, masszázsra való. Használat előtt az alapos tusolás kötelező, ezzel is csökkentve az idegen anyagok, egyéb szennyeződések bekerülését a medence vízterébe.

2. A medencében csak tiszta fürdőruhában szabad tartózkodni.

3. A medencében egyszerre max. 6 fő tartózkodhat, biztosítva ezzel a víz minőségének megőrzését.

4. Gyerekek csak felnőttek gondos felügyelete mellett használják a
medencét! Gyermekek ne használják a medencét, ha a vízhőmérséklet meghaladja a 37 ̊ C-ot!

5. Mivel a hosszas fürdőzés 38 C°-ot meghaladó hőmérsékletű vízben káros lehet az egészségre, javasoljuk, hogy a kisgyerekek és a meleg vízre érzékenyek alacsonyabb hőmérsékleten és rövidebb ideig használják a medencét!

6. Ne hagyják, hogy a gyermek víz alá merítse a fejét!

7. Ne használja a medencét, ha a testrészek és a haj beszívását
megakadályozó védőelemek el vannak távolítva! Ne üljön a vízszűrő nyílása elé vagy fölé, mivel ez gátolhatja víz keringetését és személyi sérülést okozhat.

8. Ne működtesse a masszázshelyek szivattyúit teljesen zárt fúvókákkal!

9. Ha a medence használaton kívül van, a biztonsági thermo tető mindig legyen
felszerelve és lezárva!

10. Terhes nők, gyógykezelés alatt álló vagy keringési panaszokkal rendelkező személyek kérjék orvos tanácsát a medence használatba vétele előtt!

11. Legyen elővigyázatos a be-és kiszállásnál! Kapcsolja ki a masszázsfunkciókat, mielőtt beszáll, hogy lássa hova lép! Ne használjon, elektromos berendezéseket (mint például lámpa, hajszárító, rádió, televízió) a medence 1,5 méteres körzetében (ez alól kivételt képeznek a 12 voltos, vagy annál alacsonyabb feszültséget használó készülékek).

12. Ezt a készüléket nem szánták csökkent fizikai, érzékelési vagy szellemi képességű, illetve tapasztalattal vagy ismerettel nem rendelkező személyek általi használatra (beleértve a gyermekeket is), kivéve, ha egy olyan személy felügyeli vagy tájékoztatja őket a készülék használatát illetően, aki egyben felelős a biztonságukért!

13. Az eszméletvesztés és esetleges fulladás elkerülése végett ne használjon kábítószert és ne igyon alkoholt fürdőzés előtt és közben!

14. A medencébe ételt vagy italt bevinni TILOS!

15. Amennyiben a medence vizét a nem szabályszerű használata (pl. beleömlött ital, belehullott étel, túl sok egyszerre használó személy, szennyezett, homokos ruházattal való fürdőzés, naptej használata...stb) cserélni kell , továbbá a jakuzzi használati szabályok be nem tartása esetén a kaució nem jár vissza.

## Infraszauna használatának szabályzata

1. Igyon vizet az infraszaunázás előtt, alatt és után a szervezet vízháztartási egyensúlyának megőrzése érdekében.

2. Az infraszaunáz előtti forró fürdő elősegíti az izzadási folyamat
beindulását. Ezt követően törölközzön meg a készülék használata előtt, hiszen a víz a faanyagban károsodást idézhet elő. Az infraszaunázást követő fürdő felfrissíti a szervezetet.

3. Az izzadság felitatása érdekében kérjük, helyezzen egy törölközőt a padra és egyet a pad elé a földre. Tartson egy törölközőt kéznél az izzadság eltávolítására.

4. Infraszaunázás előtt legalább egy órával ne fogyasszon ételt. A legjobb üres gyomorral használni a készüléket. NE használja az infraszaunát közvetlenül egy kimerítő testedzés után.

5. Az infraszaunázást követően NE azonnal menjünk ki a kabinból, hanem várjunk még egy kis időt az izzadási folyamat leállásáig. Ezt követően zuhanyozzunk le előbb meleg majd hidegebb vízzel, ezzel felfrissülünk és a normál hőmérsékletre hűtjük a testünket.

6. Az infraszaunázás személyre szóló hatásaival kapcsolatban kérje ki orvosa véleményét.

7. A szaunába ételt vagy italt bevinni TILOS!

## Általános biztonsági szabályok

1. Túlnyomásos tartályt az infraszaunába bevinni TILOS (Spray, stb).

2. A fűtőszálakat nem érheti víz.

3. Vizet NEM vihet a szaunába.

4. Ha a test hőmérséklete több fokkal a normális hőfok fölé emelkedik

hypertermia keletkezik, melynek a tünetei: szédülés, levertség, álmosság,

ájulás. A hypertermia következményei:

- A hőérzet működési zavara;
- Hibás helyzetfelismerés (nem hagyjuk el kellő időben a helyiséget);
- Hibás veszélyfelismerés;
- Magzati károsodás;
- Mozgásképtelenség;
- Eszméletlenség

5. Alkohol, drog vagy egyéb bódító szer hatása alatt jelentősen
megnövekszik a végzetes hypertermia előfordulása.

6. NE szárítsunk ruhát és NE hagyjunk törölközőt az infraszaunában!

7. NE érintsük meg a fűtőfelületet sem kézzel sem egyéb eszközzel!

8. NE nyúljon a világítótestekhez, azok bekapcsolt állapotában!

9. NE spricceljen folyadékot a fűtőfelületekre!

10. NE használja az infraszaunát az alábbi esetekben:

- Nyílt sebek, szembetegségek, égési sérülések.

- Idős és beteg legyengült emberek.

- Terhes nők és csecsemők számára a használat TILOS! 6 év alatti

gyermekek csak SZÜLŐI felügyelettel használhatják az infraszaunát.

- Mindenki, aki érzékeny a hőre, túlsúlyos, szívelégtelenségben, magas
vérnyomásban vagy keringési betegségekben, esetleg cukorbetegségben
szenved, a készülék használata ELŐTT KÉRJE KI AZ ORVOSA

VÉLEMÉNYÉT.

11. Kisállatot ne tegyen a készülékbe.

12. Ittas, bódult állapotban NE HASZNÁLJA az infraszaunát!

13. A szauna használati szabályok be nem tartása esetén a kaució nem jár vissza.

## Takarítás

A vendégházat a Vendégek tisztán kapják és ottlétük alatt maguk gondoskodnak a tisztaságról. Kérjük Vendégeinket, hogy őrizzék meg a ház és az udvar tisztaságát, épségét, illetve gondoskodjanak azok rendeltetésszerű használatról.

Egy hétnél hosszabb tartózkodás esetén egy alkalommal takarítást, ágyneműcserét és törölköző cserét biztosítunk. Kérésre napi takarításra is van lehetőség.

## Hulladék elhelyezése

A háztartási hulladék gyűjtése a konyhában található szemetesben lehetséges. Ha ezek megtelnének az Önök itt tartózkodása alatt, kérjük, ürítsék ki a bejárat mellett található nagy kommunális és szelektív hulladékgyűjtő edényekbe.

## Fűtés/klíma

A vendégház gázfűtéssel rendelkezik. Továbbá rendelkezésre áll egy hűtő-fűtő klíma, melyet a Vendég működtet.

A kandalló használata TILOS!

## Biztonság

A környék biztonságos, de tegyenek meg Önök is mindent, hogy véletlenül se történjen baj. Az ingatlan külső részén kamera működik személy- és vagyonvédelmi céllal, ezt probléma esetén kerül megtekintésre. Amennyiben a biztonsági berendezés megfelelő, rendeltetésszerű működését a Vendég szándékosan akadályozza, abban az esetben esetlegesen felmerülő közvetett, vagy közvetlen károkat a Vendég köteles megfizetni.

24 órás ügyeleti szolgáltatás telefonon vehető igénybe az alábbi elérhetőségen:

Név: Bándi-Schmidthoffer Klaudia

Mob..: +36 20 497 1994

A vendégház tulajdonosa, mindenkor vendégei kényelmét és pihenését tartja szem előtt. Szívesen áll rendelkezésükre bármilyen probléma felmerülése, információ szolgáltatása esetén. Kérjük, forduljanak hozzá bizalommal! A házzal kapcsolatos minőségi illetve egyéb észrevételeket a tulajdonossal közölni szíveskedjenek.

Jó pihenést és kellemes időtöltést kívánunk!$md$, null) from listings where slug = 'velence';

select save_listing_document(id, 'aszf', $md$Jelen "Általános Szerződési Feltételek" szabályozzák a Szolgáltató szálláshelyének, és szolgáltatásainak igénybevételét. Az Általános Szerződési feltételek szerint az üzemeltető, szolgáltató, Garden Vendégház Velence -2481 Velence, Szabolcsi út 83/B., továbbiakban Szolgáltató, elszállásolási Szerződést köt a magánszálláshely szolgáltatást igénybe vevő személyekkel, szerződő felekkel.

Szerződő felek

Vásárló/Vendég: A szálláshely szolgáltatását igénybe vevő, a honlapon keresztül, illetve a Szolgáltatónál a gardenvendeghazvelence@gmail.com e-mail címen keresztül írásban szolgáltatást vásárló személy, aki az ÁSZF-et tudomásul veszi és magára nézve is kötelezőnek fogadja el, továbbiakban Vendég

Szolgáltató: GardenVendégház Velence, továbbiakban Szolgáltató
Levelezési cím: gardenvendeghazvelence@gmail.com
Telefon: + 36 20 497 1994

## 1. Általános Szerződési Feltételek célja

Az Általános Szerződési Feltételek (ÁSZF) Szolgáltató és a vele szerződéses kapcsolatba lépő Vendég között létrejövő jogviszony általános feltételeit tartalmazza. Az itt nem szabályozott kérdéseket illetően Szolgáltató tevékenységére vonatkozó mindenkor hatályos magyar jogszabályok és hatósági előírások, valamint a Polgári Törvénykönyvben foglalt rendelkezések külön kikötés nélkül irányadóak.

## 2. Szerződési Feltételek elfogadása

A Szerződési Feltételek Vendég által történő elfogadása a vásárlás illetve szolgáltatás igénybevételének előfeltétele. A Feltételek elfogadásának minősül, ha Vendég a Szolgáltató által nyújtott szolgáltatást igénybe veszi.

## 3. Szerződési Feltételek hatálya

Szolgáltató fenntartja a jogot, hogy az Általános Szerződési Feltételeket részben vagy egészben bármikor módosíthatja. Az ÁSZF mindaddig hatályban marad, amíg Szolgáltató szolgáltatást biztosítja. Jelen ÁSZF 2015. augusztus 17-étől határozatlan ideig hatályos.

## 4. A szolgáltatás területi hatálya

Szolgáltató által üzemeltetett szolgáltatás mind belföldről, mind külföldről elérhető.

## 5. Szerződéses fogalmak

Vásárló/Vendég: A szálláshely szolgáltatását igénybe vevő, a honlapon keresztül szolgáltatást vásárló személy, aki az ÁSZF-et tudomásul veszi és magára nézve is kötelezőnek fogadja el, továbbiakban Vendég
Szolgáltató: a jelen ÁSZF feltételei szerint a magánszálláshely szolgáltatást nyújtó Garden Vendégház Velence, továbbiakban Szolgáltató
A szolgáltatás: magánszálláshely szolgáltatás
Árajánlat: A Vendég szóban, vagy írásban megküldött ajánlatkérésére a Szolgáltató írásos árajánlata.
Foglalás: Foglalás a Vendég írásban leadott foglalásának a Szolgáltató által írásban megküldött visszaigazolása, mely tartalmazza a szolgáltatás tárgyát, helyét, időtartamát és árát, valamint a foglalás véglegesítéséhez szükséges, a teljes szállásköltség 20%-ának megfizetésére vonatkozó adatokat.
Foglalás véglegesítés, érvényesítés:
A foglalásban meghatározott 20% megfizetése a foglalás biztosítása érdekében.
A Foglalás a 20% megfizetését követően jön létre, és így írásban megkötött Szerződésnek minősül, és egyben az ÁSZF és a Foglalási és Lemondási Feltételek, illetve a Házirend automatikus elfogadását jelenti.
Fizetési és lemondási feltételek:
A Garden Vendégház Velence által biztosított szolgáltatás ellenértékének megfizetésére, a foglalás és fizetés módjára, ütemezésére, a foglalás lemondás esetére és a lemondás esetén vissza nem térítendő összegre vonatkozó feltételek meghatározása.

## 6. Szolgáltató az alábbi feltételek szerint nyújtja a szolgáltatást

6.1. A Vendégház elsősorban egyben kiadó, összetartozó családok, baráti társaságok részére. Maximális létszám: 10+2 fő.

6.2. A Szolgáltató nem tartózkodik a Vendégházban, Önök, mint Szerződő felek, a 2481 Velence, Szabolcsi út 83/B. alatti 4 hálószobás, 2 fürdőszobás, teljesen felszerelt konyhával, nappali-étkező helyiséggel, bekerített kerttel, jakuzzi, szauna és a kerti bútorokkal, parkolóval rendelkező vendégházat és szolgáltatásait magánszálláshelyként, üdülési, pihenési célból saját felelősségükre veszik igénybe. A házban illetve a kertben található berendezéseket és felszerelést, -ideértve hozzáértés esetén a jakuzzi, szauna, illetve a kerti grill, bográcsozó hely gondos használatát, - az Önök rendelkezésére bocsátjuk ott tartózkodásuk alatt.

6.3. Minden tőlünk telhetőt megteszünk vendégeink biztonsága érdekében, felhívjuk figyelmüket az esetleges veszélyforrásokra, azonban a házban illetve az ingyenes parkolóban lévő személyes vagyontárgyaikért, valamint a ház és környezete nem rendeltetésszerű használatából eredő személyi sérülésekért, illetve a házban keletkezett károkért felelősséget nem tudunk vállalni. Az Önök által a házban, annak berendezéseiben, környezetében okozott károkért kártérítési felelősség terheli Önöket.

6.4. Probléma esetén elérhetőek vagyunk a honlapon illetve a jelen ÁSZF-ben megadott telefonszámon, illetve e-mail címen, hogy segítségükre lehessünk ott tartózkodásuk idején, távozás utáni reklamációt azonban nem tudunk elfogadni.

## 7. Ajánlatkérés, illetve foglalás menete

7.1.A Vendég szóban, vagy írásban megküldött ajánlatkérésére a Szolgáltató árajánlatot küld. Az árajánlat írásos közös megegyezés alapján módosítható. Az árajánlatra történő válasz hiányában az árajánlat 4 napos türelmi idő után törlésre kerül.

7.2. A foglalás a Vendég írásban, leadott foglalásának a Szolgáltató általi írásban megküldött visszaigazolásával, a teljes szállásköltség 20%-ának megfizetését követően jön létre, és így írásban megkötött Szerződésnek minősül, és egyben a Foglalási és Lemondási Feltételek és az ÁSZF, illetve a Házirend automatikus elfogadását jelenti. Vendég elfogadja, hogy az általa lemondott foglalásra, a foglalás érvényesítésekor előzetesen befizetett foglalási összeget a szolgáltató nem téríti vissza 30 napon belüli lemondás esetén a Vendég részére.

7.3. A szóban leadott foglalás, megállapodás, módosítás, vagy annak a Szolgáltató általi szóbeli visszaigazolása nem szerződés értékű.

7.4. A Szerződés tartalma kiterjed a szolgáltatás tárgyára, helyére, időtartamára, árára, valamint a Foglalási és Lemondási Feltételekre, Házirendre illetve a vonatkozó ÁSZF-re.

7.5. A Szerződés módosításához, kiegészítéséhez a felek általi írásos megállapodás szükséges.
Már véglegesített és visszaigazolt foglalás más dátumra történő áthelyezésére, vagy a létszám módosítására a szabad kapacitás függvényében van lehetőség.

7.6. A Szolgáltató vendégház a meghirdetett árait, - kivéve amennyiben adott időszakra kötelezettséget nem vállal, - előzetes bejelentés nélkül szabadon változtathatja.

7.7. A helyi idegenforgalmi adó a szállásdíjon felül extra fizetendő a helyszínen Vendég/éj alapon. Az idegenforgalmi adó fizetési kötelezettség a 18 év feletti személyekre vonatkozik.

7.8. A lefoglalt, de a Vendég szálláshelyen való tartózkodása alatt igénybe nem vett, illetve módosított szolgáltatások pénzbeli visszatérítésére nincs lehetőség.

## 8. A Szolgáltatás módosítása, törlése
8.1. Árajánlat:

A Vendég szóban, vagy írásban megküldött ajánlatkérésére a Szolgáltató árajánlatot küld. Az árajánlat írásos közös megegyezés alapján módosítható. Az árajánlatra történő válasz hiányában az árajánlat 4 napos türelmi idő után törlésre kerül.

8.2. Foglalás

8.2.1.Amennyiben a Szolgáltató által a foglalás megerősítéséhez kért 20% megegyezés szerinti határidőig nem kerül megfizetésre a foglalás törlésre kerül. A szóban leadott foglalás, megállapodás, módosítás, vagy annak a Szolgáltató általi szóbeli visszaigazolása nem szerződés értékű. A foglalás módosításához, kiegészítéséhez a felek általi írásos megállapodás szükséges.

8.2.2. Már véglegesített és visszaigazolt foglalás más dátumra történő áthelyezésére, vagy a létszám módosítására a szabad kapacitás függvényében van lehetőség.

8.2.3. A Szolgáltató vendégház a meghirdetett árait, - kivéve amennyiben adott időszakra kötelezettséget nem vállal, - előzetes bejelentés nélkül szabadon változtathatja.

## 9. Igénybevétel feltételei

9.1. A vendég a szállást az igénybevétel napján 14.00-18.00 óráig történő bejelentkezéssel (check-in) veheti igénybe. Kijelentkezés (check-out) az utolsó tartózkodási napon délelőtt 10.00-ig. Előzetes megállapodás esetén a kijelentkezési időpont meghosszabbítható.

9.2. A Vendég a szálláshelyre érkezéskor a hatályos jogszabályoknak megfelelően személyazonosságát köteles a szállás elfoglalása előtt igazolni.

9.3. A Vendég hibájából keletkező sérülésekért a Szálláshely nem vállal felelősséget. A rongálás miatti költségeket a szálláshely a vendégre terheli.

9.4. Amennyiben a vendég a szállást az érkezés napján reggel 9.00 előtt kívánja elfoglalni, az előző éjszaka szállásdíjának 50%-a kerül felszámításra.

9.5. A szálláshelyre előzetes egyeztetést követően kisállat hozható. Az engedély nélkül behozott kisállat, illetve az általa okozott sérülésekért, károkért a vendéget kártérítési kötelezettség terheli a szálláshely felé.

9.6. A házban tilos a dohányzás..

## 10. Szálláshely használat visszautasítása, szerződés megszűnése

10.1. A Szálláshely jogosult a szerződést felmondani és a szolgáltatásnyújtást megtagadni amennyiben a Vendég:

1. nem teljesítési fizetési kötelezettségét.
2. a vendég nem rendeltetésszerűen használja a szálláshelyet
3. fertőző betegségben szenved
4. drog befolyása alatt áll
5. elfogadhatatlan, erkölcstelen, erőszakos, összeférhetetlen magatartást tanúsít a házban és környezetében.
6. a feleken kívül álló okok, úgynevezett Vis Major (háború, tűz, árvíz, időjárásbeli viszontagság, áramhiány, sztrájk bekövetkezése), esetén, melyek felett a fél nem bír ellenőrzéssel

## 11. A Vendég jogai

1. A Vendég jogosult a Szálláshely szolgáltatási körbe tartozó rendeltetésszerű használatára,
2. A Vendég jogosult a szálláshely berendezéseinek, eszközeinek használatára.
3. A Vendég, hozzáértés esetén, jogosult a Szolgáltató vendégházban található szauna, jakuzzi, kerti grill rendeltetésszerű, gondos használatára.
3. A tartózkodás idején felmerülő bármely probléma esetén a szolgáltató telefonon illetve írásban a gardenvendeghazvelence@gmail.com címen elérhető, a probléma mielőbbi megoldása érdekében.
4. A Vendég panasztételi joga a szálláshely elhagyását követően megszűnik.

## 12. A Vendég kötelezettségei

12.1. Vendég köteles a Szerződésben foglaltak szerinti időpontig és módon kiegyenlíteni a szolgáltatások ellenértékét.
12.2. Gondoskodni arról, hogy a felügyelete alá tartozó 18 év alatti gyermekek csak felnőtt felügyelete alatt tartózkodjanak a szálláshelyen.
12.3. Vendég köteles az általa, vagy kisérője illetve a felügyelete alá tartozó személyek által okozott kárt a szolgáltatónak megtéríteni.

## 13. A Szolgáltató jogai

13.1. A Szolgáltatónak jogában áll a Vendég által megrendelt és véglegesített, de Vendég által igénybe nem vett szálláshely szolgáltatásra beérkezett 20% szállásköltség összegének megtartása jelen ÁSZF-ben és Foglalási és Lemondási feltétekben rögzítettek szerint.
13.1.2. A Szolgáltatónak jogában áll a 10.1. 1-6. pontjai alatt foglaltak esetén a szálláshely szolgáltatás visszautasítása, megszüntetése.

## 14. A Szolgáltató kötelezettsége, felelőssége

14.1.. A Szolgálató köteles a vendég tartózkodása alatti panaszát kivizsgálni és megtenni a szükséges lépéseket a probléma kezelésére.
14.2. A Szolgáltató köteles telefonos elérhetőségét megadni a Vendégnek, az ott tartózkodása alatt esetleg felmerült problémák, kérdések rendezése érdekében
14.3. Szolgáltató nem vállal felelősséget a vendég által behozott elektromos berendezésekért, azok okozta károkért a vendég a felelős.
14.4. Szolgáltató felelőssége nem terjed ki a vendég által saját maga okozott károkra illetve a vendégek körén kívül álló elháríthatatlanul bekövetkezett károkra.
14.5. Szolgáltató nem vállal felelősséget a szolgáltató közösségi tereiben illetve szobáiban hagyott személyes tárgyakért, értéktárgyakért, készpénzért.
14.6. A Szolgáltató ingyenes, bekerített parkolójában hagyott értéktárgyakért a Szolgáltató nem vállal felelősséget.

## 15. Fizetési és Lemondási Feltételek

15.1. A foglalás a Foglalási és Lemondási Feltételek Házirend illetve az ÁSZF elfogadásával, a teljes szállásdíj 20%-ának előre történő megfizetése és annak visszaigazolása után érvényes. Amennyiben a kért összeg a megjelölt határnapig nem érkezik meg, Szolgáltató ajánlati és szolgáltatási kötelezettsége is megszűnik.
15.2. A 20% megfizetése történhet átutalással, befizetéssel. A fennmaradó szállásdíj a kulcs átvételekor készpénzben vagy átutalással fizetendő. 30 napon belüli lemondás esetén a 20%-ot nem tudjuk visszatéríteni.
15.3. Bármely fizetési mód alkalmazásával kapcsolatos költség a Szerződő Vendéget terheli.

## 16. Szolgáltató kötelezettsége és felelőssége

16.1. A Szolgáltató a Szolgáltatást a Vendég részére folyamatosan biztosítja a Vendég fizetési kötelezettségének teljesítése ellenében.
16.2. A Szolgáltató nem felel olyan károkért, amelyek, erőhatalom, természeti csapás (vis major), vagy egyéb, a Szolgáltató érdekkörén kívülálló ok, illetve esemény folytán következnek be, amelyekért a Szolgáltató nem tehető felelőssé.
16.3. A Szolgáltató az árváltozás jogát fenntartja. Az oldalon lévő esetleges hibákért felelősséget nem vállal. Az ellenérték tartalmazza a szolgáltatásnak megfelelő terhelő közterheket a személyenként és éjszakánként fizetendő idegenforgalmi adó kivételével.
16.4. A Szolgáltató a vásárló Vendég adatait a szerződés teljesítése, és a szerződés feltételeinek későbbi bizonyítása érdekében tárolja, azokat azonban továbbadni sem reklámfelhasználás sem egyéb célra - a Vendég kifejezett hozzájárulása hiányában - nem jogosult.
16.5. Vendég bejelentések, panaszok kezelése
A Vendég az észlelt hibákat, panaszokat a Szolgáltatónak személyesen, telefononon, valamint a gardenvendeghazvelence@gmail.com e-mail címen jelentheti be. A Szolgáltató a bejelentéseket, panaszokat minden esetben 30 napon belül kivizsgálja, és a vizsgálat eredményéről a bejelentés módjának megfelelően tájékoztatja a Vendéget. A Szolgáltató a bejelentésekről és panaszokról nyilvántartást vezet. A Szolgáltató a Vendég által bejelentett, a vizsgálat eredményeként valósnak bizonyult és a Szolgáltató érdekkörében felmerült hiba kijavítása iránt haladéktalanul intézkedik.

## 17. A Vendég jogai és kötelezettségei

17.1. A Vendég adatok megadása során megadott téves adatokért, és az azokból adódó károkért semmilyen formában nem vállalunk felelősséget a hibás adatokból eredő esetleges téves teljesítésért.
17.2. A Vendég kötelessége a szolgáltatás fizetési mód szerinti megfizetése. A választott fizetési módtól a Vendég csak a Szolgáltató előzetes hozzájárulásával térhet el. Amennyiben a megrendelt szolgáltatás vételárát a Vendég nem tudja megfizetni, akkor a megrendelt szolgáltatás automatikusan törlődik a rendszerből.

Szolgáltató adatvédelmi elveit külön Adatvédelmi Nyilatkozatban teszi közzé honlapján.$md$, '2015-08-17') from listings where slug = 'velence';

select save_listing_document(id, 'adatvedelem', $md$Kedves Vendégeink!

A www.gardenvendeghazvelence.webnode.hu oldalon egy űrlap található, amin keresztül a Garden Vendégházba nyílik lehetőségük szállást foglalni.

Tájékoztatom Önöket, hogy a foglaláshoz a következő személyes adataiknak a megadása szükséges, melyek elengedhetetlenek a szállásadó és a vendég közötti szükséges kapcsolattartáshoz és az adatok kezeléséhez a vendégház vezetősége által annak érdekében, hogy a szerződéses jogviszonyból eredő lényeges körülményekről megfelelően tájékoztatni tudjon, valamint a számla kiállításához (NAV kötetezettség): számlázandó személy/cég neve, cég esetén az adószáma, lakóhely/székhely címe, e-mail címe, telefonszám. Továbbá az érkezéskor minden vendégnek (0 éves kortól) át kell adni a személyi igazolványát vagy útlevelét a szállásadónak elektronikus okmányolvasáshoz, ami a turisztikai adatszolgáltatás és a rendőrség zárt rendszerében lesz tárolva (NTAK kötelezettség). Utóbbi eljárásról itt olvashat: https://vizainfo.hu/szallashelyek. A honlapon keresztül történő online foglalással, mint felhasználó, elfogadja jelen adatvédelmi tájékoztató rendelkezéseit.

Az adatok kezelésével összefüggésben az adatkezelő ezúton tájékoztatja Önöket a honlapon általa kezelt személyes adatokról, a személyes adatok kezelése körében követett elveiről és gyakorlatáról a személyes adatok védelme érdekében tett szervezési és technikai intézkedéseiről, valamint az érintettek jogai gyakorlásának módjáról és lehetőségeiről. Tájékoztatom, hogy a rögzített személyes adatokat bizalmasan az adatvédelmi jogszabályokkal és nemzetközi ajánlásokkal összhangban, a jelen nyilatkozatnak megfelelően kezeli.

Tájékoztatom továbbá, hogy a személyes adatok kezelésének jogi szabályozása alapvetően változott 2018. május 25. napjától, ugyanis ezen időponttól kezdve kötelezően alkalmazandó az Európai Parlament és a Tanács (EU) természetes személyeknek a személyes adatok kezelése tekintetében történő védelméről és az ilyen adatok szabad áramlásáról, valamint a 95/46/EK rendelet hatályon kívül helyezéséről (általános adatvédelmi rendelet) szóló 2016/679. rendelete (a továbbiakban: GDPR).

A honlapon keresztül történő online foglalással, mint felhasználó elfogadja jelen adatvédelmi tájékoztató (a továbbiakban: Adatvédelmi Tájékoztató) rendelkezéseit.

## I. Alapfogalmak

személyes adat: az azonosított vagy azonosítható természetes személyre (érintettre) vonatkozó, vele kapcsolatba hozható információ - különösen az érintett neve, azonosító jele, valamint egy vagy több fizikai, fiziológiai, mentális, gazdasági, kulturális vagy szociális azonosságára jellemző ismeret -, valamint az adatból levonható, az érintettre vonatkozó következtetés.
adatállomány: az egy nyilvántartásban kezelt adatok összessége;
érintett: bármely információ alapján azonosított vagy - közvetlenül vagy közvetve - azonosítható természetes személy;
adatfeldolgozás: az adatkezelési műveletekhez kapcsolódó technikai feladatok elvégzése, függetlenül a műveletek végrehajtásához alkalmazott módszertől és eszköztől, valamint az alkalmazás helyétől, feltéve hogy a technikai feladatot az adaton végzik;
harmadik személy: olyan természetes vagy jogi személy, illetve jogi személyiséggel nem rendelkező szervezet, aki vagy amely nem azonos az érintettel, az adatkezelővel vagy az adatfeldolgozóval;
adatvédelem: az összegyűjtött adatvagyon sérthetetlenségét, integritását, használhatóságát és bizalmasságát lehetővé tevő technológiák és szervezési módszerek összessége;
adatvédelmi incidens: az adatbiztonság olyan sérülése, amely a továbbított, tárolt vagy más módon kezelt személyes adatok véletlen vagy jogellenes megsemmisítését, elvesztését, megváltoztatását, jogosulatlan közlését vagy az azokhoz való jogosulatlan hozzáférést eredményezi;
adatkezelés: az alkalmazott eljárástól függetlenül az adatokon végzett bármely művelet vagy a műveletek összessége, így különösen gyűjtése, felvétele, rögzítése, rendszerezése, tagolása, tárolása, átalakítása vagy megváltoztatása, felhasználása, lekérdezése, közlése, továbbítása, terjesztése, vagy egyéb módon történő nyilvánosságra hozatala, illetve hozzáférhetővé tétele, összehangolása vagy összekapcsolása, korlátozása, törlése és megsemmisítése, valamint az adatok további felhasználásának megakadályozása, fénykép-, hang- vagy képfelvétel készítése, valamint a személy azonosítására alkalmas fizikai jellemzők (pl. ujj- vagy tenyérnyomat, DNS-minta, íriszkép) rögzítése.
adatkezelő: az a természetes vagy jogi személy, illetve jogi személyiséggel nem rendelkező szervezet, aki vagy amely önállóan vagy másokkal együtt az adatok kezelésének célját meghatározza, az adatkezelésre (beleértve a felhasznált eszközt) vonatkozó döntéseket meghozza és végrehajtja, vagy az adatfeldolgozóval végrehajtatja.
adattovábbítás: az adat meghatározott harmadik személy számára történő hozzáférhetővé tétele.
adattörlés: az adatok felismerhetetlenné tétele oly módon, hogy a helyreállításuk többé nem lehetséges.
adatkezelés korlátozása: a tárolt személyes adatok megjelölése jövőbeli kezelésük korlátozása céljából;
hozzájárulás: az érintett akaratának önkéntes, határozott és egyértelmű kinyilvánítása, amely konkrét és megfelelő tájékoztatáson alapul, és amellyel az érintett nyilatkozat, vagy a megerősítést félreérthetetlenül kifejező cselekedet útján beleegyezését adja a rá vonatkozó személyes adatok - teljes körű vagy egyes műveletekre kiterjedő - kezeléséhez.

Hozzájárulásnak minősül, ha az érintett az internetes honlap megtekintése, illetve a foglalás véglegesítése során a kapcsolati űrlapon keresztül elküldi a foglalást a vendégház e-mail címére, valamint bármely egyéb olyan nyilatkozat vagy cselekedet, amely az adott összefüggésben az érintett személyes adatainak tervezett kezeléséhez való hozzájárulását egyértelműen jelzi.

kötelező adatkezelés: amennyiben az adatkezelést törvény vagy - törvény felhatalmazása alapján, az abban meghatározott körben - helyi önkormányzat rendelete közérdeken alapuló célból elrendeli.
nyilvánosságra hozatal: az adat bárki számára történő hozzáférhetővé tétele.
profilalkotás: személyes adatok automatizált kezelésének bármely olyan formája, amelynek során a személyes adatokat valamely természetes személyhez fűződő bizonyos személyes jellemzők értékelésére, különösen a munkahelyi teljesítményhez, gazdasági helyzethez, egészségi állapothoz, személyes preferenciákhoz, érdeklődéshez, megbízhatósághoz, viselkedéshez, tartózkodási helyhez vagy mozgáshoz kapcsolódó jellemzők elemzésére vagy előrejelzésére használják.

## II. Adatkezelő megnevezése, elérhetőségei

Adatkezelő neve: Bándi-Schmidthoffer Klaudia
Adatkezelő telefonszáma: +36204971994
Adatkezelő e-mail címe: gardenvendeghazvelence@gmail.com

## III. Adatkezelés célja

A szükséges kapcsolattartás céljából szükséges az adatait megadni a vendégház vezetőségének annak érdekében, hogy a szerződéses jogviszonyból eredő lényeges körülményekről megfelelően tájékoztatni tudja.
Szükség van továbbá személyes adataira a szállásadási szolgáltatásról történő számla kiállításához.
A magánszálláshely besorolású Garden Vendégház Velencének jogi kötelezettségei vannak, melyek teljesítéséhez is szükségesek a személyes adatok (NAV, Önkormányzata, NTAK felé).

## IV. Adatkezelés jogalapja

A III. pont első bekezdésében foglalt cél esetében a GDPR 6. cikk (1) bekezdés a) pontja alapján történik az adatok kezelése, annak érdekében, hogy a szerződéses jogviszonyból eredő lényeges körülményekről megfelelően tájékoztatni tudjuk.
A III. pont második bekezdésében foglalt cél esetében a GDPR 6. cikk (1) bekezdés b) pontja, vagyis olyan szerződés teljesítése, amelyben a Vendég, mint érintett az egyik fél.
A III. pont harmadik bekezdésében foglalt cél esetében a GDPR 6. cikk (1) bekezdés c) pontja, vagyis az adatkezelőre vonatkozó jogi kötelezettség teljesítése, mégpedig az adatkezelőre háruló bizonylat, számla készítési kötelezettség.

A fentieken felüli egyéb célból, illetve egyéb jogalapon történő adatkezelés szükségességének felmerülése esetén adatkezelő egyedileg, az adatkezelés megkezdését megelőzően tájékoztatni köteles az érintettet a végezni kívánt adatkezeléssel kapcsolatos minden fontos információról és az azzal kapcsolatos jogaikról.

## V. Kezelt adatok köre

A foglaláshoz az alábbi személyes adatok megadása szükségesek:

Foglaló/számlázandó személy/cég neve
Számlázandó személy/cég lakóhelyének/székhelyének címe
Cég esetén az adószáma
Foglaló személy e-mail címe
Foglaló személy telefonszáma
Érkező vendégek száma
Érkezés és távozás napja
Érkezés körülbelüli ideje

Az érkezéskor minden vendégnek (0 éves kortól) át kell adni a személyi igazolványát vagy útlevelét a szállásadónak elektronikus okmányolvasáshoz, ami a turisztikai adatszolgáltatás és a rendőrség zárt rendszerében lesz tárolva (NTAK kötelezettség). Utóbbi eljárásról itt olvashat: https://vizainfo.hu/szallashelyek.

## VI. Adatkezelés időtartama

Az adatok kezelése a Vendég telefonszáma és e-mail címe vonatkozásában a foglalás időpontjának megadásától kezdődik és a Vendégnek az Vendégházból történő távozását követően 90 nap múlva törlésre kerül.

A Vendég nevének és számlázási címének vonatkozásában a számviteli törvényben foglalt ideig, 8 (nyolc) évig történik az adatok kezelése, ezt követően adatkezelő megsemmisíti azokat.

## VII. Adatbiztonság

Adatkezelő minden szükséges lépést megtesz, hogy biztosítsa a Vendégek által megadott személyes adatok biztonságát mind a hálózati rendszer, mind az adatok tárolása, őrzése során. Az adatkezelő munkafolyamatait vírusirtóval védett számítógépen végzi.

## VIII. Kamerarendszer

A vendégház területén térfigyelő kamera üzemel az érintettek személyi és vagyoni biztonsága érdekében és egyéb célokból. Ezek működtetésére az érintettek figyelmét tájékoztató tábla hívja fel a bejáratnál.
Az adatkezelés célja: az adatkezelő tulajdonában álló vagyon védelme, jogsértő cselekmények megelőzése, bizonyítása.
Az adatkezelés jogalapja: az adatkezelő jogos érdeke. Az adatkezelőnek jogos érdeke fűződik a tulajdonában álló vagyon megóvásához, a székhelyén történő jogsértések megelőzéséhez, illetve bizonyításához.
A kezelt adatok köre: A vendégház területére belépő személyeknek a képfelvételeken látszódó arcképmása és egyéb, a megfigyelőrendszer által rögzített személyes adatai. Az adatszolgáltatás automatikus, az ingatlanra történő belépéssel megtörténik.
Az adatkezelés időtartama: felhasználás hiányában 3 munkanap.
A felvételeket fokozott adatbiztonsági intézkedések mellett tároljuk, így biztosított, hogy illetéktelen személyek ne tekinthessék meg és másolhassák ki a felvételeket. A kamerák aktuális képének megtekintésére, adathordozóra rögzítésére kizárólag az Adatkezelő erre kijelölt munkavállalója jogosult.
A vendégteret megfigyelő kamera helye/látószöge: vendégház bejárata/bejárat, parkoló.

## IX. Vendég jogai és jogérvényesítési lehetőségei

A Vendég jogosult arra, hogy az adatkezelőtől visszajelzést kapjon arra nézve, hogy személyes adatainak kezelése folyamatban van-e és ha folyamatban van, akkor tájékoztatást kapjon a kezelt adatairól, és az adatkezelést érintő minden releváns információról.

A Vendég kérheti, hogy adatkezelő indokolatlan késedelem nélkül helyesbítse a rá vonatkozó pontatlan személyes adatokat. Figyelembe véve az adatkezelés célját, kérheti személyes adatainak kiegészítését.

A Vendég kérheti személyes adatainak törlését, kivéve, ha az adatkezelés szükséges az adatkezelő jogi kötelezettségeinek teljesítéséhez vagy jogi igények előterjesztéséhez, érvényesítéséhez, illetve védelméhez. Adatkezelő a személyes adatot indokolatlan késedelem nélkül törli, ha az adat kezelése: jogellenes, az hiányos, vagy téves, az adatkezelés célja megszűnt, vagy a tárolás határideje lejárt, illetve azt bíróság vagy hatóság elrendelte, illetve törlése az adatkezelőre vonatkozó, jogszabályban foglalt kötelezettség teljesítéséhez szükséges.

Ha az adatkezelő személyes adatot az érintett hozzájárulása folytán kezel az érintett ezen hozzájárulását visszavonhatja. Amennyiben az adatkezelésnek nincs más jogalapja az adatkezelő a visszavont hozzájárulással érintett személyes adatot törli.

A Vendég jogosult arra, hogy kérésére adatkezelő korlátozza az adatkezelést, ha:

a Vendég vitatja a személyes adatok pontosságát - a pontosság ellenőrzéséhez szükséges ideig;
az adatkezelés jogellenes, de a Vendég ellenzi az adatok törlését és a felhasználás korlátozását kéri;
adatkezelőnek már nincs szüksége a személyes adatokra adatkezelés céljából, de az érintett igényli azokat jogi igényének előterjesztéséhez, érvényesítéséhez vagy védelméhez; vagy
az érintett tiltakozik adatainak közérdekből vagy az adatkezelő, illetve harmadik személy jogos érdekén alapuló kezelése ellen.

A korlátozás ideje alatt az adatkezelő a személyes adatokat a tároláson kívül más célra nem használhatja.

A Vendég jogainak gyakorlása esetén adatkezelő megvizsgálja az érintett kérelmét és a szükséges intézkedéseket megteszi és ezekről, illetve ezek elmaradásának indokairól a kérelem kézhezvételét követő egy hónapon belül tájékoztatja a Vendéget.

Jogérvényesítés:

A Vendég az adatkezeléssel kapcsolatos kérelmét a II. pontban foglalt adatkezelő részére az ugyanitt rögzített címre, vagy e-mail címre küldheti meg.

Jogainak megsértése esetén az érintett az adatkezelő címe szerint illetékes törvényszékhez, vagy - választása szerint - a lakóhelye, ennek hiányában pedig tartózkodási helye szerint illetékes törvényszékhez fordulhat és keresetet nyújthat be.

A Vendég továbbá panasszal fordulhat a Nemzeti Adatvédelmi és Információszabadság Hatósághoz (1125 Budapest, Szilágyi Erzsébet Fasor 22/c., a továbbiakban: NAIH) és vizsgálatot kezdeményezhet arra hivatkozva, hogy személyes adatai kezelésével kapcsolatosan jogsérelem következett be vagy annak közvetlen veszélye áll fenn.

Az Európai Unió Hivatalos Lapja

Az Európai Unió Hivatalos Lapjának GDPR szövege itt olvasható : a www.gdpr.info.hu oldalán (2020.11.18).$md$, null) from listings where slug = 'velence';

select save_listing_document(id, 'kornyek', $md$A Velencei-tavi aktuális programokról az alábbi oldalakon van lehetőség tájékozódni:

- https://ilovevelenceito.hu/
- https://velenceito.info/category/programok/
- https://www.velenceturizmus.hu/Programok
- https://velencekorzo.hu/programok_hu.html
- https://velenceitohajozas.hu/
- https://www.velenceitonal.hu/szolgaltatok/programok
- https://hellovelence.hu/hu/products/7/latnivalok
- https://karikazzunk.blog.hu/2022/03/10/velencei-to_latnivaloi$md$, null) from listings where slug = 'velence';

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
