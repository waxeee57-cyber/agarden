-- ============================================================
-- 01_schema — Garden/Napsugár booking data layer (Neon Postgres).
-- Ported from supabase/migrations/01 (Supabase removed 2026-10-14):
--   * tenant_members -> admin_users (own auth; no auth.users).
--   * No RLS / anon grants: the DB is reached ONLY from server code
--     (lib/db.ts, import 'server-only') with the owner role. Authorization
--     lives in the app layer (lib/admin/auth.ts).
-- Kept: btree_gist exclusion constraint on occupancy (half-open daterange
-- [check_in, check_out) => same-day turnover never collides).
-- ============================================================

create extension if not exists btree_gist;

create table if not exists tenants (
  id         uuid primary key default gen_random_uuid(),
  name       text not null,
  created_at timestamptz default now()
);

create table if not exists admin_users (
  id            uuid primary key default gen_random_uuid(),
  email         text not null unique,
  password_hash text not null,
  tenant_id     uuid not null references tenants on delete cascade,
  role          text not null check (role in ('owner', 'admin')) default 'owner',
  created_at    timestamptz default now()
);

create table if not exists listings (
  id               uuid primary key default gen_random_uuid(),
  tenant_id        uuid not null references tenants on delete cascade,
  slug             text not null unique,
  name             text not null,
  status           text not null check (status in ('active', 'placeholder')) default 'placeholder',
  rental_mode      text not null check (rental_mode in ('whole_unit')) default 'whole_unit',
  capacity_max     int,
  capacity_extra   int default 0,
  min_nights       int not null default 2,
  description      text,
  ntak_id          text,
  contact_email    text,
  contact_phone    text,
  nightly_rate_huf int,                -- null => quote-only (no public price)
  pricing_mode     text not null check (pricing_mode in ('fixed', 'quote', 'demo')) default 'quote',
  sort_order       int default 0,
  created_at       timestamptz default now()
);

create table if not exists listing_surcharges (
  id          uuid primary key default gen_random_uuid(),
  listing_id  uuid not null references listings on delete cascade,
  code        text not null check (code in ('single_night', 'pet', 'event')),
  label       text not null,
  amount_huf  int not null,
  calc        text not null check (calc in ('per_stay', 'per_night', 'flat')) default 'per_stay',
  active      boolean not null default true,
  unique (listing_id, code)
);

-- Dates are nullable: a dateless quote_request (lead) is allowed. Real
-- bookings via book_listing always carry them. CHECK passes when either is NULL.
create table if not exists bookings (
  id                  uuid primary key default gen_random_uuid(),
  listing_id          uuid not null references listings on delete cascade,
  guest_name          text not null,
  guest_email         text not null,
  guest_phone         text,
  check_in            date,
  check_out           date,
  nights              int,
  guests_count        int,
  pet                 boolean not null default false,
  is_event            boolean not null default false,
  status              text not null check (status in ('quote_request', 'pending', 'confirmed', 'cancelled')) default 'pending',
  subtotal_huf        int,
  surcharge_total_huf int,
  total_huf           int,
  currency            text default 'HUF',
  notes               text,
  source              text not null default 'web' check (source in ('web', 'manual')),
  created_at          timestamptz default now(),
  check (check_out > check_in)
);

create index if not exists bookings_listing_created_idx on bookings (listing_id, created_at desc);

create table if not exists occupancy (
  id          uuid primary key default gen_random_uuid(),
  listing_id  uuid not null references listings on delete cascade,
  during      daterange not null,
  kind        text not null check (kind in ('booking', 'manual', 'external')),
  booking_id  uuid references bookings on delete cascade,
  note        text,
  created_at  timestamptz default now(),
  constraint occupancy_no_overlap
    exclude using gist (listing_id with =, during with &&)
);

create index if not exists occupancy_listing_during_idx
  on occupancy using gist (listing_id, during);
