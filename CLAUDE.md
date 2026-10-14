# agarden — Garden Vendégház

## MI EZ
Multi-property foglalási rendszer a Garden Vendégház számára (`package.json`
description: "Garden Vendeghaz — multi-property booking system (data layer)").
A repo a README szerint három szeletet tartalmaz: adatréteg + foglalási logika
(DB-ben, RPC-kben), booking app layer (`lib/booking`), és a `/velence` showcase
oldal működő foglalási UI-jal. A foglalási logika a Postgres-ben él, a TypeScript
csak validál és normalizál.

## STACK (mérve: package.json, 2026-07-18)
- next@16.2.6
- react@19.2.4 / react-dom@19.2.4
- @supabase/supabase-js@^2.105.3, @supabase/ssr@^0.10.3
- zod@^4.4.3
- server-only@^0.0.1
- tailwindcss@^4.3.0 + @tailwindcss/postcss@^4 (dev)
- typescript@^5 (`strict: true` a tsconfig.json-ban), eslint@^9 + eslint-config-next@16.2.6
- supabase CLI @^2.105.0 (dev), pg@^8.21.0, tsx@^4.19.2
- Csomagkezelő: pnpm (`pnpm-lock.yaml`, `pnpm-workspace.yaml`, `.npmrc` jelen van)
- Deploy: Vercel — bizonyíték: `.vercel/project.json`, `projectName: "agarden"`
  (org `team_V64ulBaqijgPiNpcecFTKvs9`)

## FUTTATÁS
```bash
pnpm dev            # next dev
pnpm build          # node scripts/secret-guard.mjs && next build
pnpm start          # next start
pnpm lint           # eslint
pnpm typecheck      # tsc --noEmit
pnpm secret-guard   # node scripts/secret-guard.mjs
pnpm db:reset       # supabase db reset
pnpm db:test        # supabase db reset && node scripts/db-test.mjs && node supabase/test.mjs
pnpm db:test:app    # supabase db reset && node scripts/db-test.mjs && tsx supabase/test-app.mjs
pnpm test           # node supabase/test.mjs
pnpm test:app       # tsx supabase/test-app.mjs
```

## STRUKTÚRA
- `app/` — Next App Router. `app/api/` (availability, quote, booking, quote-request),
  `app/velence/` (showcase oldal), `app/layout.tsx`, `app/page.tsx`, `app/globals.css`
- `components/velence/` — a Velence oldal UI komponensei (Calendar, quote breakdown stb.)
- `lib/` — `booking/` (app layer entry pointok), `supabase.ts` (anon, böngésző),
  `supabase-server.ts` (anon + cookie session), `supabase-admin.ts` (service_role,
  `import 'server-only'`), `env.ts`, `format.ts`, `gallery.ts`, `rate-limit.ts`, `velence.ts`
- `scripts/` — `secret-guard.mjs` (build-time titok-szivárgás guard), `db-test.mjs`, `remote-seed.mjs`
- `supabase/` — migrációk, seed, `test.mjs` / `test-app.mjs` smoke tesztek
- `public/` — statikus assetek (`public/velence/` galéria konvenció)

## KONVENCIÓK
- TypeScript strict = true (`tsconfig.json`).
- Foglalási logika **kizárólag a DB-ben** (SECURITY DEFINER RPC-k), TS-ben nincs duplikálva.
- RLS minden táblán engedélyezve (README "RLS (enabled on every table)").
- Titok-szeparáció: service_role kulcs csak `lib/supabase-admin.ts`-ben, `server-only`
  importtal; `scripts/secret-guard.mjs` a buildben statikusan blokkolja a szivárgást;
  `eslint.config.mjs` `no-restricted-imports` a backup.
- Stabil hibakódok, nyers DB-szöveg soha nem szivárog ki: `overlap`, `min_nights`,
  `invalid_dates`, `capacity_unavailable`, `listing_not_found`, `validation_error`, `unknown`.
- Árak HUF-ban (`subtotal_huf`, `total_huf`, `currency: "HUF"`) — eltér a DomRol globális
  "minden ár EUR-ban" szabálytól; ez a projekt magyar vendégház, HUF a natív pénznem.
- Globális DomRol szabályok közül ide vonatkozik: RLS soha nem disabled, `.env` soha nem
  commitolva, `npx tsc --noEmit` minden change után, console.log tilos production kódban,
  commit formátum `feat/fix/chore/style/seo: leírás`.

## HOL TART
- Utolsó commit: 2026-06-05 — `fix(velence): accented surcharge labels + compress hero image`
- Branch: `main`
- Uncommitted: 1 fájl
- A README szerint Slice 1–3 kész (adatréteg, app layer, `/velence` oldal).
  Vendégház #2 / #3 szándékosan `placeholder` — nincs kitalált adat, amíg a tulajdonos
  meg nem adja.

## FIGYELEM
- A DB tesztekhez **Docker + futó Supabase CLI stack kell** (`npx supabase start`).
- `pnpm build` elbukik, ha a secret-guard titok-szivárgást talál — ez szándékos, ne kerüld meg.
- A `.env.local` jelen van a munkamásolatban (gitignorálva) — soha ne commitold.
- A Velence ár **DEMO placeholder** (`pricing_mode='demo'`), nem valós díjszabás.
- `SUPABASE_DB_URL` / `SUPABASE_URL` / `SUPABASE_ANON_KEY` csak a script/teszt réteg
  env-jei (`supabase/.env.test`), nem az app runtime-é.
