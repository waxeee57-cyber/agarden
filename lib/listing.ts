import 'server-only'
import { cache } from 'react'
import { query, queryOne } from './db'
import type { Site } from './site-map'
import { legalFromDb, type LegalData } from './legal'

// Listing data for the public sites + admin. Replaces lib/velence.ts: there are
// NO fallback constants — if the DB is unreachable the page errors (app/error.tsx
// shows phone/e-mail), it never renders invented or stale data.

export type Spaces = { tag: string; title: string; items: string[] }[]
export type ListingContent = {
  eyebrow?: string
  lead?: string
  highlights?: string[]
  intro_eyebrow?: string
  intro_title?: string
  intro_body?: string
  spaces_title?: string
  spaces?: Spaces
  wellness_eyebrow?: string
  wellness_title?: string
  wellness?: { k: string; t: string; d: string }[]
  amenities_title?: string
  amenities?: { t: string; d: string }[]
  equipment?: string[]
  kids?: string[]
  contact_hours?: string | null
  faq?: { q: string; a: string }[]
  seo?: { title?: string; description?: string }
  sister_pitch?: string
}

export type Surcharge = { code: 'single_night' | 'pet' | 'event'; label: string; amount: number; calc: string; active: boolean }

export type Listing = {
  id: string
  slug: Site
  name: string
  siteName: string
  tagline: string | null
  capacityMax: number
  capacityExtra: number
  minNights: number
  ntakId: string | null
  contactEmail: string | null
  contactPhone: string | null
  nightlyRate: number | null
  pricingMode: 'fixed' | 'quote' | 'demo'
  address: string | null
  geo: { lat: number; lng: number } | null
  checkinWindow: string | null
  checkoutTime: string | null
  houseRules: { t: string; d: string }[]
  content: ListingContent
  surcharges: Surcharge[]
  legal: LegalData
}

export type Photo = { id: string; url: string; width: number; height: number; alt: string; sortOrder: number; isCover: boolean }

type ListingRow = {
  id: string; slug: string; name: string; site_name: string | null; tagline: string | null
  capacity_max: number | null; capacity_extra: number | null; min_nights: number
  ntak_id: string | null; contact_email: string | null; contact_phone: string | null
  nightly_rate_huf: number | null; pricing_mode: Listing['pricingMode']
  address: string | null; geo_lat: number | null; geo_lng: number | null
  checkin_window: string | null; checkout_time: string | null
  house_rules: Listing['houseRules']; content: ListingContent; legal: unknown
}

export const getListing = cache(async (slug: Site): Promise<Listing | null> => {
  const row = await queryOne<ListingRow>(
    `select id, slug, name, site_name, tagline, capacity_max, capacity_extra, min_nights, ntak_id,
            contact_email, contact_phone, nightly_rate_huf, pricing_mode, address, geo_lat, geo_lng,
            checkin_window, checkout_time, house_rules, content, legal
       from listings where slug = $1 and status = 'active'`,
    [slug]
  )
  if (!row || row.capacity_max == null) return null
  const surcharges = await query<{ code: Surcharge['code']; label: string; amount_huf: number; calc: string; active: boolean }>(
    `select code, label, amount_huf, calc, active from listing_surcharges where listing_id = $1 order by code`,
    [row.id]
  )
  return {
    id: row.id,
    slug,
    name: row.name,
    siteName: row.site_name ?? row.name,
    tagline: row.tagline,
    capacityMax: row.capacity_max,
    capacityExtra: row.capacity_extra ?? 0,
    minNights: row.min_nights,
    ntakId: row.ntak_id,
    contactEmail: row.contact_email,
    contactPhone: row.contact_phone,
    nightlyRate: row.nightly_rate_huf,
    pricingMode: row.pricing_mode,
    address: row.address,
    geo: row.geo_lat != null && row.geo_lng != null ? { lat: row.geo_lat, lng: row.geo_lng } : null,
    checkinWindow: row.checkin_window,
    checkoutTime: row.checkout_time,
    houseRules: row.house_rules ?? [],
    content: row.content ?? {},
    surcharges: surcharges.map((s) => ({ code: s.code, label: s.label, amount: s.amount_huf, calc: s.calc, active: s.active })),
    legal: legalFromDb(row.legal),
  }
})

/** Just the id (cheap) — used by the host-scoped public API routes. */
export async function getListingId(slug: Site): Promise<string | null> {
  const row = await queryOne<{ id: string }>(`select id from listings where slug = $1 and status = 'active'`, [slug])
  return row?.id ?? null
}

export const getPhotos = cache(async (listingId: string): Promise<Photo[]> => {
  const rows = await query<{ id: string; blob_url: string; width: number; height: number; alt: string; sort_order: number; is_cover: boolean }>(
    `select id, blob_url, width, height, alt, sort_order, is_cover from listing_photos
      where listing_id = $1 order by is_cover desc, sort_order, created_at`,
    [listingId]
  )
  return rows.map((r) => ({ id: r.id, url: r.blob_url, width: r.width, height: r.height, alt: r.alt, sortOrder: r.sort_order, isCover: r.is_cover }))
})

