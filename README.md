# Garden Vendégház + Napsugár Vendégház

Két önálló weboldal két, egyben bérelhető velencei vendégházhoz — **egy kódbázis,
egy Vercel projekt, egy Neon Postgres, egy design-rendszer**. Online foglalási
kérelem (nincs online fizetés), ajánlatkérés, tulajdonosi admin.

| ház | domain | listing slug |
|---|---|---|
| Garden Vendégház Velence | https://garden-vendeghaz-velence.vercel.app | `velence` |
| Napsugár Vendégház Velence | https://napsugar-vendeghaz-velence.vercel.app | `napsugar` |

## Architektúra

- **Host-alapú routing** — `proxy.ts` a kérés hostjából (`SITE_HOST_MAP`) eldönti a
  házat, és belsőleg `app/[site]/…`-ra rewrite-ol. Egy hoston csak a saját ház
  érhető el (`/napsugar` a Garden hoston 404). Ismeretlen host → Garden + `noindex`.
  Régi `/velence` a Garden hoston → 301 `/`.
- **Adatbázis** — Neon Postgres (fra1). Foglalási logika SQL-függvényekben
  (`db/migrations/02–03`): `quote_booking`, `book_listing`, `request_quote`,
  `admin_block`, `admin_set_booking_status`. Átfedés-védelem: `btree_gist`
  exclusion constraint (`occupancy_no_overlap`), half-open `[check_in, check_out)`.
- **DB-hozzáférés** — kizárólag `lib/db.ts` (`import 'server-only'`, paraméterezett
  lekérdezések). Kliensoldali DB-hozzáférés nincs; RLS nincs (egyetlen szerver-szerep),
  a jogosultság az alkalmazásrétegben (`lib/admin/auth.ts`).
- **Publikus API** (`app/api/*`) — a listinget mindig a hostból oldja fel, soha nem
  a kliens által küldött azonosítóból. Mutáló végpontok: Origin-ellenőrzés + DB-s rate-limit.
- **Admin** — saját auth: scrypt jelszó-hash, aláírt httpOnly/Secure/SameSite=Lax
  session süti (jose, 7 nap), hostonként külön. A session a host házára szól; a másik
  ház admin-API-ja 401-et ad. Login rate-limit DB-ből (IP + fiók).
- **Fotók** — Vercel Blob; feltöltéskor `sharp` (≤1200 px, WebP, EXIF törölve) → `listing_photos`.
- **E-mail** — Resend, env-kapcsolóval (`EMAIL_ENABLED`); hiba esetén a foglalás megmarad.
- **SEO** — hostonkénti `robots.txt`, `sitemap.xml`, canonical/`metadataBase`, OG-kép
  (`/brand/og`), favicon (`/brand/icon`), manifest, JSON-LD (LodgingBusiness, WebSite,
  BreadcrumbList, FAQPage) — csak tárolt tényekből.

## Parancsok

```bash
pnpm dev              # http://velence.localhost:3000 és http://napsugar.localhost:3000
pnpm build            # secret-guard + next build
pnpm typecheck && pnpm lint
pnpm db:migrate       # db/migrations/*.sql (DATABASE_URL_UNPOOLED), egyszer futnak
pnpm test             # eldobható agarden_test DB-n: SQL + app réteg tesztek
pnpm admin:create <email>   # tulaj-fiók; jelszó CSAK a gitignore-olt .admin-credentials-be
pnpm photos:import --site <velence|napsugar> --dir <mappa> --manifest db/photo-manifests/<site>.json
```

## Saját domain később

1. Vercelen: domain hozzáadása a projekthez + DNS.
2. `SITE_HOST_MAP` elejére az új host, pl.
   `gardenvendeghaz.hu=velence,garden-vendeghaz-velence.vercel.app=velence,…`
   (az első host a kanonikus). Kódmódosítás nem kell.

## Nincs kitalált adat

Ár nincs: mindkét ház `pricing_mode='quote'`, amíg a tulaj az adminban be nem állítja.
Ismeretlen adat (Garden utcacím, Napsugár e-mail, üzemeltetői adatok) null / TBD, és nem jelenik meg.
