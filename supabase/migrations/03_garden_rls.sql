-- ============================================================
-- 03_garden_rls — Row Level Security on every table.
--
-- Access model:
--   anon          -> SELECT active listings + their active surcharges only.
--                    Availability ONLY via get_listing_availability (no PII).
--                    NO direct read of bookings/occupancy. NO direct booking
--                    insert (goes through the book_listing definer RPC).
--   authenticated -> full CRUD on rows of tenants they are owner/admin of
--                    (via is_tenant_admin). Cross-tenant access denied.
--   service_role  -> bypasses RLS (used by lib/supabase-admin.ts server-side).
--
-- Policies are idempotent (DROP IF EXISTS + CREATE) so re-running reproduces
-- the same state — same pattern as RentalOS 01b_base_policies.sql.
-- ============================================================

alter table tenants            enable row level security;
alter table tenant_members     enable row level security;
alter table listings           enable row level security;
alter table listing_surcharges enable row level security;
alter table bookings           enable row level security;
alter table occupancy          enable row level security;

-- ------------------------------------------------------------
-- tenants — an admin sees only tenants they belong to.
-- ------------------------------------------------------------
drop policy if exists tenants_admin_read on tenants;
create policy tenants_admin_read on tenants
  for select to authenticated
  using (is_tenant_admin(id));

-- ------------------------------------------------------------
-- tenant_members — a user sees only their own membership rows.
-- ------------------------------------------------------------
drop policy if exists tenant_members_self_read on tenant_members;
create policy tenant_members_self_read on tenant_members
  for select to authenticated
  using (user_id = auth.uid());

-- ------------------------------------------------------------
-- listings — public reads active; admin has full CRUD on own tenant.
-- (SELECT policies are OR'd: an admin sees active listings everywhere PLUS
--  all of their own tenant's listings, including 'placeholder'.)
-- ------------------------------------------------------------
drop policy if exists listings_public_read on listings;
create policy listings_public_read on listings
  for select to anon, authenticated
  using (status = 'active');

drop policy if exists listings_admin_all on listings;
create policy listings_admin_all on listings
  for all to authenticated
  using (is_tenant_admin(tenant_id))
  with check (is_tenant_admin(tenant_id));

-- ------------------------------------------------------------
-- listing_surcharges — public reads active surcharges of active listings;
-- admin full CRUD on own tenant's surcharges.
-- ------------------------------------------------------------
drop policy if exists surcharges_public_read on listing_surcharges;
create policy surcharges_public_read on listing_surcharges
  for select to anon, authenticated
  using (
    active
    and exists (
      select 1 from listings l
      where l.id = listing_surcharges.listing_id and l.status = 'active'
    )
  );

drop policy if exists surcharges_admin_all on listing_surcharges;
create policy surcharges_admin_all on listing_surcharges
  for all to authenticated
  using (is_tenant_admin(listing_tenant(listing_id)))
  with check (is_tenant_admin(listing_tenant(listing_id)));

-- ------------------------------------------------------------
-- bookings — PII. NO anon policy (deny-by-default). Admin full on own tenant.
-- Public booking creation happens through the book_listing definer RPC.
-- ------------------------------------------------------------
drop policy if exists bookings_admin_all on bookings;
create policy bookings_admin_all on bookings
  for all to authenticated
  using (is_tenant_admin(listing_tenant(listing_id)))
  with check (is_tenant_admin(listing_tenant(listing_id)));

-- ------------------------------------------------------------
-- occupancy — NO anon policy (deny-by-default). Admin full on own tenant.
-- Availability is exposed to anon only via get_listing_availability (no PII).
-- ------------------------------------------------------------
drop policy if exists occupancy_admin_all on occupancy;
create policy occupancy_admin_all on occupancy
  for all to authenticated
  using (is_tenant_admin(listing_tenant(listing_id)))
  with check (is_tenant_admin(listing_tenant(listing_id)));
