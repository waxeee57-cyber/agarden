# Garden Vendeghaz

Multi-property booking system for Garden Vendeghaz. Built on the RentalOS
conventions (pnpm + Next 16, `@supabase/supabase-js` / `@supabase/ssr`, flat
`lib/supabase*.ts` clients, numbered idempotent migrations, `btree_gist`
exclusion constraint for overlap, node smoke tests).

This repository currently contains **Slice 1 — data layer + booking logic** and
**Slice 2 — the booking app layer** (no UI). UI / landing / photos come later.

---

## Data model

| Table | Purpose |
|---|---|
| `tenants` | One row per owner/business. |
| `tenant_members` | `(user_id, tenant_id, role)` — basis for admin RLS. |
| `listings` | One rentable property. `status` `active` (public) or `placeholder` (TBD stub). `pricing_mode` `fixed`/`quote`/`demo`. |
| `listing_surcharges` | Optional per-listing fees: `single_night`, `pet`, `event` × `per_stay`/`per_night`/`flat`. |
| `bookings` | Guest reservation record (holds PII). |
| `occupancy` | **The single source of truth for availability.** Bookings *and* manual/external blocks write a row here. |

**Overlap is impossible at the DB level**, not in app code:

```sql
constraint occupancy_no_overlap
  exclude using gist (listing_id with =, during with &&)
```

`during` is a **half-open** `daterange [check_in, check_out)`, so a guest checking
out on the same day another checks in does **not** collide (same-day turnover is
intentionally allowed).

### Booking logic (RPCs, `SECURITY DEFINER`)

All logic lives in the database and runs atomically. Definer functions are owned
by `postgres` (bypasses RLS in-body), so `anon` can quote/book/check availability
through these RPCs **without any direct table grants**.

- `get_listing_availability(listing, from, to)` → booked ranges, **no PII**. anon-callable.
- `quote_booking(listing, check_in, check_out, pet, is_event)` → pure calc:
  `{ valid, reason, nights, subtotal_huf, applied_surcharges[], total_huf, … }`.
  Min-nights rule with the explicit 1-night exception (1-night only allowed when a
  `single_night` surcharge exists, and that surcharge applies only to 1-night stays).
  `nightly_rate_huf IS NULL` ⇒ quote-only, `total_huf` stays null.
- `book_listing(…)` → re-validates, then inserts `bookings` + `occupancy` in **one
  transaction**. Overlap trips the exclusion constraint → rollback →
  `{ ok:false, reason:'overlap' }`. Success → `{ ok:true, booking_id, total_huf }`.
- `admin_block(listing, from, to, kind, note)` → manual/external block,
  tenant-admin only.

### RLS (enabled on every table)

- **anon** — SELECT `active` listings + their active surcharges only. Availability
  *only* via `get_listing_availability` (no PII). No direct read of
  `bookings`/`occupancy`; no direct booking insert (goes through `book_listing`).
- **authenticated (admin)** — full CRUD on rows of tenants they own/admin
  (`is_tenant_admin`). Cross-tenant access denied.
- **service_role** — bypasses RLS; used server-side via `lib/supabase-admin.ts`.

---

## Server-only secret separation

| File | Key | Where it runs |
|---|---|---|
| `lib/supabase.ts` | anon | browser |
| `lib/supabase-server.ts` | anon (cookie session) | SSR / server actions |
| `lib/supabase-admin.ts` | **service_role** | server only — first line is `import 'server-only'` |

Two guards enforce that the service_role key can never reach the client bundle:

1. `import 'server-only'` in `lib/supabase-admin.ts` makes `next build` fail if it
   is ever pulled into a client bundle.
2. `scripts/secret-guard.mjs` (runs in `pnpm build`) statically rejects any
   client-reachable module that imports a server-only file or references a
   non-`NEXT_PUBLIC_` secret, and any module mixing the anon + admin clients.
   `eslint.config.mjs` adds a `no-restricted-imports` rule as a fast-fail backup.

---

## How to run / test

Prereqs: Docker running, `pnpm`, and the Supabase CLI (`npx supabase …` works).

```bash
pnpm install
npx supabase start          # boots the local stack (Postgres + Auth + PostgREST)
pnpm db:reset               # apply migrations + seed on a fresh DB
pnpm db:test                # db reset + write supabase/.env.test + run the test suite
```

`pnpm db:test` is the full acceptance run. It boots from a fresh DB and proves:

- overlapping booking **rejected** by the exclusion constraint (DB-level, not app);
- same-day turnover (`check_out == check_in`) **allowed**;
- `nights==2` valid, `single_night` **not** applied; `nights==1` valid, surcharge **applied**;
- `nights==1` on a min-2 listing without `single_night` ⇒ invalid `min_nights`;
- pet surcharge math + final total exact;
- anon **cannot** read `bookings`/`occupancy` PII; anon availability RPC works;
- admin full access to their own tenant; cross-tenant **denied**.

Other commands: `pnpm typecheck`, `pnpm lint`, `pnpm secret-guard`.

---

## Slice 2 — booking app layer (`lib/booking`)

Four entry points wrap the slice-1/slice-2 RPCs. They **only** validate input
shape (zod), call the RPC, and normalize the result — the booking logic
(min-nights, overlap, surcharge math) stays in the DB and is **never** duplicated
in TypeScript. Everything runs on the **anon client** through `SECURITY DEFINER`
RPCs (least privilege — no `service_role` in this slice). Thin HTTP wrappers live
under `app/api/{availability,quote,booking,quote-request}`.

```ts
getAvailability({ listingId, from, to })
  -> { ok: true, ranges: { during, kind }[] } | { ok: false, reason }

getQuote({ listingId, checkIn, checkOut, guests, pet?, isEvent? })
  -> { valid, reason, nights, subtotal, surcharges: {code,label,amount}[],
       total, currency, pricingMode }            // pure; writes nothing

createBooking({ listingId, checkIn, checkOut, guests, guestName, guestEmail,
                guestPhone?, pet?, isEvent? })
  -> { ok, bookingId?, total?, reason? }          // status 'pending'

requestQuote({ listingId, guestName, guestEmail, checkIn?, checkOut?, guests?,
               guestPhone?, pet?, isEvent?, message? })
  -> { ok, bookingId?, status: 'quote_request', reason? }  // lead; no price, no date lock
```

**Stable error codes** (no raw DB text ever leaks): `overlap`, `min_nights`,
`invalid_dates`, `capacity_unavailable`, `listing_not_found`, `validation_error`,
`unknown`.

### Examples

```jsonc
// getQuote (Velence, 1 night) — single_night surcharge applies
in:  { "listingId":"22222222-…", "checkIn":"2026-10-01", "checkOut":"2026-10-02", "guests":2 }
out: { "valid":true, "reason":null, "nights":1, "subtotal":75000,
       "surcharges":[{"code":"single_night","label":"1 ejszakas felar","amount":15000}],
       "total":90000, "currency":"HUF", "pricingMode":"demo" }

// createBooking onto already-booked dates — DB exclusion constraint, not JS
out: { "ok":false, "reason":"overlap" }

// requestQuote on a placeholder (#2/#3) or quote-only listing — lead, no date lock
out: { "ok":true, "bookingId":"…", "status":"quote_request" }
```

### Additive migration (`04_booking_app_layer.sql`)

Slice-1 migrations are untouched. Two additions, each justified inline:
`get_listing_booking_meta` (PII-free listing capacity for the app-level check, so
placeholders hidden from anon RLS are still resolvable) and `request_quote` (a
quote request is a lead — it inserts a `quote_request` booking but **no**
occupancy row, and tolerates soft/missing dates; the booking date columns are
relaxed to `NULL`able for that).

### Test it

```bash
pnpm db:test:app   # db reset + write .env.test + run the slice-2 app test (tsx)
```

Proves: quote math via RPC (2-night/1-night/pet/placeholder); overlap rejected
from the DB; `guests > capacity` and placeholder → `capacity_unavailable`;
`requestQuote` succeeds without blocking dates; zod rejects bad email / inverted
dates / bad uuid as `validation_error` **without** calling the RPC.
(Slice-1 DB tests remain: `pnpm db:test`.)

---

## Slice 3 — the `/velence` showcase page

The first visible, shareable artifact: the full Velence subpage with gallery and a
working booking UI wired to the slice-2 API. **No booking logic in the UI** — the
calendar/quote/booking all call `/api/*`.

- **Identity:** "warm lakeside" — lake-pine + terracotta clay on warm sand paper,
  display serif **Fraunces** + humanist **Hanken Grotesk** (both `latin-ext` for
  Hungarian), film-grain atmosphere, signature water-ripple dividers + a wax-seal
  "egyben bérelhető" stamp. Mobile-first; staggered scroll reveals.
- **Content:** real Velence facts only (10+2 fő, 4 háló + erkély, földszinti
  terek, 6 fős jakuzzi + 2 fős szauna, kert grill/bogrács, parkolás 3 autóra,
  állatbarát, min. 2 éj, NTAK MA22041986, kapcsolat). Listing meta is fetched live
  (anon) with seed-matching fallback so the page renders even without the DB.
- **Booking UI** (`components/velence/`): availability-aware `Calendar` (disables
  booked nights via `GET /api/availability`; a checkout on a booked day is allowed
  — same-day turnover), live `getQuote` with itemized breakdown, a **DEMO-price
  notice**, `createBooking` with humanized error mapping, and a parallel
  **ajánlatkérés** path (`requestQuote`, soft dates, no date lock).

### Gallery photo convention

Drop files into `public/velence/` (also documented in `public/velence/README.md`):

```
public/velence/velence-hero.jpg      # optional full-bleed hero background
public/velence/velence-01.jpg … -08  # gallery slots (jpg|jpeg|png|webp|avif)
```

Missing files render an intentional, on-brand placeholder (never a grey box) — the
gallery looks finished even with no photos yet.

### Preview it locally

```bash
npx supabase start          # local Postgres + Auth + PostgREST (Docker)
pnpm db:reset               # migrations + seed
# write .env.local with the local keys (NEXT_PUBLIC_SUPABASE_URL / _ANON_KEY [+ SERVICE_ROLE]):
npx supabase status -o env  # copy API_URL / ANON_KEY / SERVICE_ROLE_KEY into .env.local
pnpm dev                    # http://localhost:3000  ->  redirects to /velence
```

`/api/availability` (GET) feeds the calendar; `/api/quote`, `/api/booking`,
`/api/quote-request` (POST) drive the rest. An additive `GET` handler was added to
the availability route (same `getAvailability` call) for the calendar.

---

### Seed contents

- **Velence** (`active`): real data from the brief — capacity 10 (+2), NTAK
  `MA22041986`, contacts, 3 surcharges. Price is an explicit **DEMO** placeholder
  (`pricing_mode='demo'`, flagged in the description) — this business is
  quote-based, there is no public nightly rate.
- **Vendeghaz #2 / #3** (`placeholder`): capacity / NTAK / price all `NULL` — no
  invented data until the owner provides it.
- A couple of `external` occupancy blocks on Velence so the availability lock is
  demonstrable.
