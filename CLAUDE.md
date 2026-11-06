# agarden — Garden Vendégház + Napsugár Vendégház

## MI EZ
Két önálló, host-routolt weboldal két velencei vendégházhoz, közös foglalási
rendszerrel és tulajdonosi adminnal. Részletek: `README.md`, `PRODUCT.md`.

## STACK (mérve: package.json, 2026-10-14)
- next@16.4.3 (App Router, Turbopack, `proxy.ts`), react@19.3.1, tailwindcss@^4.3
- pg@^8.21 (Neon Postgres, fra1), @vercel/blob@^2.8, sharp@^0.35, jose@^6.2, zod@^4.4 (e-mail küldő függőség NINCS)
- react-leaflet@^5 (csak Napsugár térkép), playwright (dev)
- pnpm; Vercel projekt `agarden` (prj_g6OafEGKz6bea67AEg2UMxHcx3g5), régió fra1 (`vercel.json`)
- **Supabase nincs** (2026-10-14-én eltávolítva).

## KONVENCIÓK
- Host → ház: `lib/site-map.ts` (`SITE_HOST_MAP`), kliensbiztos konstansok: `lib/sites.ts`.
- DB csak `lib/db.ts`-en át, `import 'server-only'`, paraméterezett SQL. Kliens nem ér DB-t.
- Publikus API a listinget a HOSTBÓL oldja fel. Admin API: `requireAdminApi` (session + host + Origin).
- Foglalási logika SQL-ben (`db/migrations`), TS-ben nincs duplikálva.
- Árak HUF-ban (magyar piac). Nincs kitalált adat: ismeretlen = null/TBD, nem renderelődik.
- `pnpm build` előtt `scripts/secret-guard.mjs` fut — ha elbukik, NE kerüld meg.
- Egységes arculat (2026-10-30): `[data-skin=velence|napsugar]` csak az akcentust váltja (`app/globals.css`); Gilda Display + Hanken Grotesk mindkét házon. Közös oldalkeret: `components/property/SiteChrome.tsx` (`SitePage`), adatok: `lib/page.ts` (`loadSite`), menü: `lib/nav.ts`.
- Tulajdonosi szövegek (házirend, ÁSZF, GYIK, Környék, adatkezelés): `listing_documents` markdown-lite (`lib/markdown.ts`), minden mentés verzió (utolsó 20, `save_listing_document`). Bankszámlaszám (`listings.bank_account`) CSAK a foglaló vendégnek jelenhet meg (foglalási válasz + kód+e-mail lekérdezés, `paymentInfo`), no-store; `lib/listing.ts` szándékosan nem olvassa, publikus oldalra soha.
- A gyökér és a `[site]` not-found kliens-komponens: szerveroldali `headers()` ott minden házoldalt dinamikussá tenne (ISR elveszne).
- Logó/OG: kézi SVG (`lib/mark.ts`) + valódi font (GildaDisplay/Schibsted TTF az `assets/fonts`-ban, ő/ű ellenőrizve). AI-szöveges kép tilos.
- E2E: `node scripts/e2e-server.mjs` (agarden_test DB, :3100) + `node --env-file=.e2e-env tests/admin-e2e.mjs <out>`.
- Jogi oldalak: ismeretlen üzemeltetői adat = `<Pending>` („pótlásra vár”), soha nem kitalált.

## FIGYELEM
- Tesztek az `agarden_test` DB-n futnak (minden futáskor eldobva + migrálva), nem a prod `neondb`-n.
- `.admin-credentials` (gitignore) — tulaj jelszó. Soha ne commitold, ne írd ki.
- `.env.local` — `vercel env pull`-ból + helyi `ADMIN_SESSION_SECRET`. Soha ne commitold.
- Foglalás: webes foglalás AZONNAL `confirmed` (tulaj nélkül). Vendég: visszaigazoló képernyő + `/foglalasom` (kód+e-mail) előleg-adatokkal. Tulaj: admin Események (`booking_events`, DB-triggerek írják). A honlap NEM küld e-mailt (nincs SMTP/API/harmadik fél); ne vezess vissza külső levelezőt vagy kézi visszaigazolást kérés nélkül.
- Árazás: `listing_seasons` (éjszakánkénti szezonár, érkezési szezon min. éjszakája) + létszámfelár (`extra_guest_from/huf`), mind `quote_booking`-ban.
- iCal: export `/api/ical/<token>.ics` (csak saját foglalás + kézi blokk), import `ical_feeds` → occupancy kind 'external', cron `/api/cron/ical` 3 óránként (`CRON_SECRET` kell). Foglaltság cache: `availability` tag, minden változás `invalidateAvailability()`.
