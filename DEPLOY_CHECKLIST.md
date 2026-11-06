# Üzemeltetési checklist – Garden Vendégház Velence & Napsugár Vendégház Velence

## Architektúra (0 Ft havi többletköltség, külső levelező nélkül)

| Réteg | Megoldás | Költség |
|---|---|---|
| Tárhely, futtatás | Vercel (a meglévő Pro előfizetésen) | 0 Ft többlet |
| Adatbázis | Neon Postgres, ingyenes csomag | 0 Ft |
| Képek | Vercel Blob | a Pro keretén belül |
| Térkép | OpenStreetMap (Leaflet) | 0 Ft |
| Naptár-szinkron | iCal export/import, Vercel Cron 3 óránként | 0 Ft |
| **E-mail** | **nincs külső szolgáltató.** A honlap maga nem küld levelet; minden foglalás kérelemként az adminba kerül, a vendégnek szóló kész levelet az admin a tulaj saját levelezőjében nyitja meg (`mailto:`) | 0 Ft |
| **Fizetés** | **érkezéskor, a helyszínen, készpénzben.** Nincs előleg, átutalás, kártya, bankszámla, fizetési szolgáltató | 0 Ft |

Az oldalmegtekintés nem ébreszti az adatbázist: az oldalak statikusak (admin-mentéskor azonnal frissülnek),
a foglaltság tárolt példányból jön, és csak foglaláskor / admin-változáskor / iCal-szinkronkor frissül.

## Állapot

| Elem | Állapot |
|---|---|
| Deploy, migrációk (1–21) | ✅ automatikus (a Production build futtatja) |
| `CRON_SECRET` | ✅ beállítva a Vercelben; nélküle is biztonságosan fut (10 perces globális korlát) |
| Foglalás → admin | ✅ minden webes foglalás **kérelem** (`pending`), automatikus visszaigazolás nincs; a napokat azonnal fenntartja, a döntés a tulajé |
| iCal-ütközés | ✅ ha egy külső naptár (Airbnb/Booking) olyan napot jelez, amire nálunk kérelem/foglalás van, az admin „Mi a teendőd?” sürgős tételként mutatja |
| Házirend / ÁSZF | ⏳ a tulaj eredeti (Webnode) szövege még 20% előleget ír; az admin jelzi, a tulaj saját feltételei szerint igazítja (Admin → Szövegek). Jogi szöveget a rendszer nem ír át |
| Adatvédelmi oldal | ✅ e-mail adatfeldolgozó nincs; Vercel + Neon szerepel |
| Árak, szezonok | ⏳ a tulaj számai kellenek (admin → Árak). Addig a foglaló „egyedi ajánlatot” mutat, foglalni így is lehet |
| Adatfeldolgozói jóváhagyás | ⏳ az adatkezelő (tulaj) nyilatkozata (admin → Adatok); addig az oldalon „pótlásra vár” |

## A tulaj napi munkája (nincs technikai beállítás)

1. Admin → **Foglalások** → „Új” szűrő: minden kérelmet átnéz (vendég, létszám, üzenet, iCal-ütközés).
   Megfelelő → **Visszaigazolás**; nem megfelelő → **Elutasítás** (a napok felszabadulnak).
2. Ugyanott **„Visszaigazoló / Lemondó e-mail megírása”**: a saját levelezőjében megnyílik a kész levél
   (időpont, létszám, végösszeg, „fizetés érkezéskor, a helyszínen, készpénzben”, érkezési infó) → Küldés.
   Telefonon is értesítheti. Az „Események” napló minden kérelmet és döntést automatikusan rögzít.
3. A vendég a foglalási kóddal a **Foglalásom** oldalon bármikor látja az állapotot.

## Opcionális

- **Naptár-szinkron** (Airbnb / Booking.com / Szállás.hu): admin → Naptár → a saját linkünk a platformba, az ő linkjük ide.
- **Nagyobb felbontású Garden-fotók** (egyszeri, Roli):
  ```bash
  vercel env pull .env.local
  pnpm photos:import --site velence --dir db/source/garden-webnode/img --manifest db/photo-manifests/velence.json --replace
  ```
- **Saját domain**: Vercelben hozzáadás → `SITE_HOST_MAP` első host-ja → Redeploy.
- A Vercelben maradt régi, már nem használt változók (`RESEND_API_KEY`, `EMAIL_FROM`, `EMAIL_ENABLED`) törölhetők; a kód nem olvassa őket.
