# Üzemeltetési checklist – Garden Vendégház Velence & Napsugár Vendégház Velence

## Architektúra (0 Ft havi többletköltség, külső levelező nélkül)

| Réteg | Megoldás | Költség |
|---|---|---|
| Tárhely, futtatás | Vercel (a meglévő Pro előfizetésen) | 0 Ft többlet |
| Adatbázis | Neon Postgres, ingyenes csomag | 0 Ft |
| Képek | Vercel Blob | a Pro keretén belül |
| Térkép | OpenStreetMap (Leaflet) | 0 Ft |
| Naptár-szinkron | iCal export/import, Vercel Cron 3 óránként | 0 Ft |
| **Visszaigazolás** | **azonnali, automatikus**: a foglalás a küldés pillanatában `confirmed`; a vendég a képernyőn és a Foglalásom oldalon (kód + e-mail) látja az állapotot és az előleg adatait. Nincs e-mail, nincs külső szolgáltató, nincs kézi lépés | 0 Ft |

Az oldalmegtekintés nem ébreszti az adatbázist: az oldalak statikusak (admin-mentéskor azonnal frissülnek),
a foglaltság tárolt példányból jön, és csak foglaláskor / admin-változáskor / iCal-szinkronkor frissül.

## Állapot

| Elem | Állapot |
|---|---|
| Deploy, migrációk (1–18) | ✅ automatikus (a Production build futtatja) |
| `CRON_SECRET` | ✅ beállítva a Vercelben; nélküle is biztonságosan fut (10 perces globális korlát) |
| Foglalás → admin | ✅ azonnal; külső szolgáltatás kiesése nem tudja megakasztani (nincs külső szolgáltatás) |
| Adatvédelmi oldal | ✅ e-mail adatfeldolgozó nincs; Vercel + Neon szerepel |
| Árak, szezonok | ⏳ a tulaj számai kellenek (admin → Árak). Addig a foglaló „egyedi ajánlatot” mutat, foglalni így is lehet |
| Adatfeldolgozói jóváhagyás | ⏳ az adatkezelő (tulaj) nyilatkozata (admin → Adatok); addig az oldalon „pótlásra vár” |

## Garanciák (hibatűrés, biztonság)

- **Nincs kézi lépés a foglaláshoz**: érvényes dátumra a foglalás azonnal visszaigazolt, a tulaj távollétében is.
- **Dupla foglalás kizárt**: az adatbázis kizárási megkötése atomikusan dönt (5 egyidejű kérésből pontosan 1 nyer – teszt).
- **Szabályok az adatbázisban**: múltbeli érkezés, 2 évnél távolabbi érkezés, 90 éjnél hosszabb tartózkodás, minimum éjszaka, kapacitás – a böngészőt megkerülve sem foglalható.
- **Nincs külső függőség a foglalás útjában**: se e-mail-, se fizetési szolgáltató; ami nincs, nem tud kiesni. Hibánál a vendég barátságos üzenetet kap, nem 500-at.
- **Vendégadat védelme**: a számlaszám és az előleg csak a foglaló vendégnek látszik (foglalási válasz, illetve kód + e-mail), gyorsítótárazás nélkül; publikus oldalon soha. A lekérdezés rate-limitelt, rossz kódra és rossz e-mailre ugyanazt válaszolja.
- **Audit napló**: minden foglalási esemény (új, visszaigazolt, lemondott, törölt) adatbázis-trigger írja – egyetlen kódút sem hagyhatja ki; az admin „Események” blokkja mutatja.
- **Naptár-szinkron**: 8 mp-es időkorlát és 2 MB-os méretkorlát forrásonként; hibás vagy elérhetetlen forrás a korábban beolvasott foglalt napokat nem törli, és saját foglalást sosem ír felül.

## Ami továbbra is emberi döntés (tudatosan)

- **Árak**: amíg nincs megadva, a foglalás érvényes, az előleg %-ban látszik, összeg nélkül (kitalált ár nem kerül ki).
- **Lemondás a tulaj részéről**: a napok felszabadulnak, a vendég a Foglalásom oldalon „Lemondva” állapotot lát (push-értesítés nincs).
- **Dátum nélküli ajánlatkérés és Kapcsolat-üzenet**: természetüknél fogva válaszra várnak; az admin listázza őket.
- **Adatfeldolgozói jóváhagyás**: az adatkezelő nyilatkozata.

## Opcionális

- **Naptár-szinkron** (Airbnb / Booking.com / Szállás.hu): admin → Naptár → a saját linkünk a platformba, az ő linkjük ide.
- **Nagyobb felbontású Garden-fotók** (egyszeri, Roli):
  ```bash
  vercel env pull .env.local
  pnpm photos:import --site velence --dir db/source/garden-webnode/img --manifest db/photo-manifests/velence.json --replace
  ```
- **Saját domain**: Vercelben hozzáadás → `SITE_HOST_MAP` első host-ja → Redeploy.
- A Vercelben maradt régi, már nem használt változók (`RESEND_API_KEY`, `EMAIL_FROM`, `EMAIL_ENABLED`) törölhetők; a kód nem olvassa őket.
