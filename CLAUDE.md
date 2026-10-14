# agarden — Garden Vendégház + Napsugár Vendégház

## MI EZ
Két önálló, host-routolt weboldal két velencei vendégházhoz, közös foglalási
rendszerrel és tulajdonosi adminnal. Részletek: `README.md`, `PRODUCT.md`.

## STACK (mérve: package.json, 2026-10-14)
- next@16.2.6 (App Router, Turbopack, `proxy.ts`), react@19.2.4, tailwindcss@^4.3
- pg@^8.21 (Neon Postgres, fra1), @vercel/blob@^2.8, sharp@^0.35, jose@^6.2, resend@^6.32, zod@^4.4
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
- Logó/OG: kézi SVG + valódi font (Fraunces/Hanken TTF az `assets/fonts`-ban, ő/ű ellenőrizve). AI-szöveges kép tilos.

## FIGYELEM
- Tesztek az `agarden_test` DB-n futnak (minden futáskor eldobva + migrálva), nem a prod `neondb`-n.
- `.admin-credentials` (gitignore) — tulaj jelszó. Soha ne commitold, ne írd ki.
- `.env.local` — `vercel env pull`-ból + helyi `ADMIN_SESSION_SECRET`. Soha ne commitold.
- E-mail ki van kapcsolva (`EMAIL_ENABLED=false`), amíg nincs Resend-hitelesített küldő domain.
