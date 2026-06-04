-- ============================================================
-- 01_garden_schema — Garden Vendeghaz data layer (tables + constraints)
-- Slice 1: multi-property booking system.
--
-- Design notes:
--   * Multi-tenant (tenants + tenant_members). RentalOS is single-tenant
--     (admin_users); since this product is multi-property we follow the spec's
--     membership model. Every other convention (btree_gist exclusion for
--     overlap, idempotent DDL, numbered migrations) is reused from RentalOS.
--   * occupancy is the SINGLE source of truth for "is this listing taken".
--     Bookings AND manual/external blocks both write a row here. The half-open
--     daterange [check_in, check_out) makes same-day turnover non-overlapping.
-- ============================================================

-- btree_gist is required for the exclusion constraint (uuid `=` + range `&&`).
create extension if not exists btree_gist;

-- ------------------------------------------------------------
-- tenants — one row per owner/business.
-- ------------------------------------------------------------
create table if not exists tenants (
  id         uuid primary key default gen_random_uuid(),
  name       text not null,
  created_at timestamptz default now()
);

-- ------------------------------------------------------------
-- tenant_members — basis for admin RLS. (user_id, tenant_id) is the PK.
-- ------------------------------------------------------------
create table if not exists tenant_members (
  user_id    uuid not null references auth.users on delete cascade,
  tenant_id  uuid not null references tenants on delete cascade,
  role       text not null check (role in ('owner', 'admin')),
  created_at timestamptz default now(),
  primary key (user_id, tenant_id)
);

-- ------------------------------------------------------------
-- listings — one rentable property. status 'active' is publicly visible;
-- 'placeholder' is a stub (TBD data) visible only to its tenant's admins.
-- ------------------------------------------------------------
create table if not exists listings (
  id              uuid primary key default gen_random_uuid(),
  tenant_id       uuid not null references tenants on delete cascade,
  slug            text not null unique,
  name            text not null,
  status          text not null check (status in ('active', 'placeholder')) default 'placeholder',
  rental_mode     text not null check (rental_mode in ('whole_unit')) default 'whole_unit',
  capacity_max    int,                 -- null for placeholders (TBD)
  capacity_extra  int default 0,       -- Velence: +2
  min_nights      int not null default 2,
  description     text,
  ntak_id         text,                -- null for placeholders
  contact_email   text,
  contact_phone   text,
  nightly_rate_huf int,               -- nullable; null => quote-only (no public price)
  pricing_mode    text not null check (pricing_mode in ('fixed', 'quote', 'demo')) default 'quote',
  sort_order      int default 0,
  created_at      timestamptz default now()
);

-- ------------------------------------------------------------
-- listing_surcharges — optional per-listing fees.
-- ------------------------------------------------------------
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

-- ------------------------------------------------------------
-- bookings — guest-facing reservation record (holds PII).
-- ------------------------------------------------------------
create table if not exists bookings (
  id                  uuid primary key default gen_random_uuid(),
  listing_id          uuid not null references listings on delete cascade,
  guest_name          text not null,
  guest_email         text not null,
  guest_phone         text,
  check_in            date not null,
  check_out           date not null,
  nights              int not null,
  guests_count        int not null,
  pet                 boolean not null default false,
  is_event            boolean not null default false,
  status              text not null check (status in ('quote_request', 'pending', 'confirmed', 'cancelled')) default 'pending',
  subtotal_huf        int,
  surcharge_total_huf int,
  total_huf           int,
  currency            text default 'HUF',
  notes               text,
  created_at          timestamptz default now(),
  check (check_out > check_in)
);

-- ------------------------------------------------------------
-- occupancy — the single source of truth for availability.
-- The exclusion constraint makes overlapping ranges on one listing physically
-- impossible at the DB level (no app-level race window). Half-open ranges mean
-- check_out == next guest's check_in does NOT collide (same-day turnover OK).
-- ------------------------------------------------------------
create table if not exists occupancy (
  id          uuid primary key default gen_random_uuid(),
  listing_id  uuid not null references listings on delete cascade,
  during      daterange not null,           -- [check_in, check_out)
  kind        text not null check (kind in ('booking', 'manual', 'external')),
  booking_id  uuid references bookings on delete cascade,  -- set when kind='booking'
  note        text,
  created_at  timestamptz default now(),
  constraint occupancy_no_overlap
    exclude using gist (listing_id with =, during with &&)
);

create index if not exists occupancy_listing_during_idx
  on occupancy using gist (listing_id, during);
