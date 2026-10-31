# Garden + Napsugár átépítés — riport (2026-10-30/31)

Jelölés: **[REPO]** = a kódból/tesztből mérve, **[DEPLOY]** = az élő oldalon mérve.

## 1. Mi készült el

- **Egységes arculat mindkét házon** [REPO]: azonos szerkezet, tipográfia (Young Serif + Schibsted Grotesk), komponensek, menü. Házanként csak a kézi SVG jel, az akcentusszín (Garden olíva `#556126`, Napsugár medencekék `#0E6070`) és a fotók térnek el. Az ő/ű glifeket mindkét fontban fontTools cmap-ellenőrzés igazolta, és a képernyőképeken is helyesek.
- **Főoldal a velenceviolavilla.hu szerkezetére** [REPO][DEPLOY]:
  - Sorrend: inset hero (felülcím, név, cím, Foglalás + Hívás) → 4 fotó → élő foglaltsági naptár → „A házról” → tény-sáv 4 ikonnal → 6 elemes „Ami a házhoz tartozik” → „Miért minket?” osztott kártya → „Jó tudni” → testvérház → sötét lábléc.
  - A naptárban kijelölt dátumok átkerülnek a foglalási varázslóba.
- **Fejléc** [DEPLOY]: balra logó, jobbra Foglalás gomb és Menü gomb (panel, desktopon is).
  - Menü: A ház, Foglalás, Képek, Házirend, ÁSZF, Kapcsolat, GYIK, Környék & programok, Testvérházunk.
  - A GYIK és a Környék csak akkor jelenik meg, ha be van kapcsolva és van szövege.
  - A panel alján telefon, e-mail és a kitöltött social linkek.
- **Aloldalak** [DEPLOY, mind HTTP 200]: `/a-haz`, `/foglalas`, `/kepek`, `/hazirend`, `/aszf`, `/kapcsolat`, `/gyik`, `/kornyek` (Garden), `/adatvedelem`, `/sutik`.
  - A Napsugár `/kornyek` 404, szándékosan: nincs még szövege.
- **„Hülyebiztos” foglalás** [REPO e2e]:
  - 4 lépés: dátum → létszám és extrák → adatok → összegzés.
  - „Inkább felhívlak” gomb minden lépésen, hibaüzenet a mező mellett, 48 px-es célterületek.
  - „Módosítom” linkek az összegzésben, egyértelmű siker-képernyő.
  - A testvérház-ajánlat megmaradt.
- **Garden-adatok** (09-es migráció) [REPO teszt]:
  - Cím: 2481 Velence, Szabolcsi út 83/B.
  - 4 hálószoba, 2 fürdő, egész évben nyitva.
  - Facebook és Instagram link.
  - 20% előleg, 30 napos lemondás, 24 órás visszaigazolás, 4 napig érvényes ajánlat.
  - A webnode-os házirend, ÁSZF, GDPR és programok szó szerint (`db/source/garden-webnode/`).
  - A „fizetés a helyszínen” szöveg a Garden GYIK-ból és a levelekből kicserélve.
- **Fotók** [DEPLOY]: a Garden 25 saját fotója felkerült a webnode-ról (eredeti JPEG, sharp → WebP 1200 px, EXIF törölve), kategóriákkal és 3 kiemelt képpel. A régi 3 kép lecserélve.
- **Admin** [REPO e2e]:
  - Szövegek: markdown-lite szerkesztő eszköztárral, előnézettel, hatálydátummal, figyelmeztetéssel mentetlen változásra, az utolsó 20 verzió visszaállítással.
  - Képek: többes feltöltés folyamatjelzővel, kategóriák, húzás és ↑↓ rendezés, borító + 3 kiemelt, alt szöveg, törlés megerősítéssel.
  - Adatok:
    - social linkek domain-ellenőrzéssel, menü-kapcsolók;
    - előleg, lemondás és bankszámla (a számla csak a visszaigazoló e-mailbe kerül, publikus oldalra soha, ezt teszt igazolja).
  - „Mi a teendőd?” kártya, a Kapcsolat-űrlap üzenetei (90 nap után törlődnek), mobil alsó tabsáv.
- **SEO** [DEPLOY]:
  - Minden aloldalnak saját title, description, canonical és BreadcrumbList.
  - `LodgingBusiness` + `VacationRental` címmel, geo koordinátával, `sameAs` linkekkel, szobaszámmal.
  - FAQPage a `/gyik` oldalon.
  - A sitemap minden publikus aloldalt tartalmaz.
  - A házoldalak újra ISR-esek (●). Javított hiba: a `not-found` `headers()`-hívása minden oldalt dinamikussá tett.

## 2. Mérések

- **Tesztek** [REPO]: DB 16/16, app 22/22, admin e2e 12/12 lépés (teszt-DB-n). Ebből a brief által kért tesztek:
  - verzió mentése és visszaállítása;
  - social URL-validáció;
  - menü-kapcsoló;
  - 401 munkamenet nélkül;
  - Garden-munkamenettel nem írható a Napsugár.
- **Lighthouse 12.8.2, mobil, 3 futás (pontszámok futásonként)** [DEPLOY]:

| oldal | Teljesítmény | Akadálymentesség | Best practices | SEO | LCP (ms) |
|---|---|---|---|---|---|
| Garden `/` | 95 / 95 / 96 | 100 | 100 | 100 | 2823 / 2804 / 2605 |
| Garden `/foglalas` | 98 / 77 / 96 | 100 | 100 | 100 | 2316 / 3618 / 2647 |
| Napsugár `/` | 91 / 97 / 94 | 100 | 100 | 100 | 2815 / 2114 / 2962 |
| Napsugár `/foglalas` | 97 / 89 / 98 | 100 | 100 | 100 | 2352 / 2631 / 2320 |

  - Mediánok: 95, 96, **94**, 97. A Napsugár-főoldal mediánja egy ponttal a 95-ös cél alatt van.
  - Az LCP-elem a hero-kép. A kiugró futásokban a TTFB (1,7 s, hideg cache) vagy a renderelési késleltetés dominált.
  - Nyers JSON: `lighthouse/`.
- **Képernyőképek** [DEPLOY]: `prod/` (1440 és 390 px, mindkét domain, 9 oldal + nyitott menü). Vízszintes görgetés: 0, konzolhiba: 0. Admin- és varázslóképek: `e2e/`.

## 3. Az 5 átvett elv (velenceviolavilla.hu)

1. **Inset, fotóra épülő hero** egy fő CTA-val. A Hívás gomb rögtön mellette van.
2. **Fotósáv közvetlenül a hero alatt**: négy saját kép visz a galériába.
3. **Foglaltsági naptár a főoldalon.** Nálunk a kijelölt dátumok a varázslóba is átkerülnek.
4. **Tények ikonokkal két szinten**: 4 kulcstény a sávban, 6 szolgáltatás a rácsban.
5. **Rövid, gyakorlati infók a lábléc előtt.** A referencia csúszkája helyett statikus „Jó tudni” blokk: gyorsabb, és a kereső is olvassa.

Ahol szándékosan eltértünk:
- A fejlécben vízszintes menüsor helyett menügomb van, mert a konzultációs brief ezt kérte.
- A főoldalon legfeljebb 5 különböző fotó van.
- A Napsugárnál nincs külön transzfer- vagy kerékpár-blokk, mert ilyen szolgáltatás nincs.

## 4. Nyitott tulajdonosi teendők

1. **Bankszámlaszám** az előleghez: Admin → Adatok. Addig a visszaigazoló levélben „telefonon vagy válaszlevélben egyeztetjük” áll, és ez a „Mi a teendőd?” kártyán is látszik.
2. **E-mail élesítése**: a domrol.com DNS-rekordjai (Resend DKIM, SPF, MX a `send` aldomainhez) még nincsenek fent a dns24.hu-n. Addig `EMAIL_ENABLED=false`. A foglalások és az üzenetek ettől függetlenül nem vesznek el: az adminban megjelennek.
3. **Üzemeltetői adatok** (név, székhely, adószám) a generált jogi oldalakhoz: Admin → Adatok.
4. **Napsugár Környék-szöveg**: ha lesz, a menüpont magától megjelenik.
5. **TikTok**: egyik háznak sincs ismert linkje. Ha lesz, az Adatok fülön megadható.
6. **Jogi átnézés**: a Garden saját ÁSZF-je (hatályos 2015-08-17) és GDPR-szövege szó szerint került át. A GDPR a NAIH régi címét tartalmazza (1125 Szilágyi Erzsébet fasor). Alatta a honlap saját, naprakész adatkezelési kiegészítése jelenik meg. A tulajdonos javíthatja a Szövegek fülön.
7. **Élő admin-folyamat**: a teszt-foglalás és törlése, a házirend-szerkesztés és visszaállítása, valamint a képfeltöltés és törlése a teszt-DB-n, valódi Blob-tárhellyel futott le. Az éles adminba a tulajdonosi jelszóval nem léptem be, ezt az éles próbát a tulajdonosnak kell elvégeznie.

## 5. Ami nem volt elérhető

- A brief eredeti referenciája, a `violavilla.hu` nem létezik (NXDOMAIN). A helyes cím a `velenceviolavilla.hu`, ezt Roli adta meg 2026-10-30-án.
- Velencei Napsugár webnode nem található. A `napsugarvendeghaz.webnode.hu` a gólopi ház, és 6 további aldomain-változat 404-et adott.
- A Garden térképpontja utca szintű (OSM way 24713301), mert a 83/B házszám nincs benne az OpenStreetMapben. Az útvonaltervezés a pontos címre mutat.
