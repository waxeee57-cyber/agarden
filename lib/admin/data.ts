import 'server-only'
import { query, queryOne } from '../db'
import { legalFromDb, type LegalData } from '../legal'
import { socialFromDb, type SocialLinks } from '../social'
import { termsFromDb, settingsFromDb, type Terms, type SiteSettings, type DocKind } from '../terms'

// Admin reads. EVERY query is scoped by the listing id from the verified
// session (lib/admin/auth.ts) — never by a client-supplied id.

export type BookingStatus = 'quote_request' | 'pending' | 'confirmed' | 'cancelled'
export type AdminBooking = {
  id: string
  status: BookingStatus
  source: 'web' | 'manual'
  guestName: string
  guestEmail: string
  guestPhone: string | null
  checkIn: string | null
  checkOut: string | null
  nights: number | null
  guests: number | null
  children: number
  pet: boolean
  isEvent: boolean
  total: number | null
  notes: string | null
  createdAt: string
}

export const FILTERS = {
  uj: { label: 'Új', statuses: ['pending', 'quote_request'] as BookingStatus[] },
  visszaigazolt: { label: 'Visszaigazolt', statuses: ['confirmed'] as BookingStatus[] },
  lemondott: { label: 'Lemondott', statuses: ['cancelled'] as BookingStatus[] },
  mind: { label: 'Mind', statuses: ['pending', 'quote_request', 'confirmed', 'cancelled'] as BookingStatus[] },
} as const
export type FilterKey = keyof typeof FILTERS

export async function listBookings(listingId: string, filter: FilterKey): Promise<AdminBooking[]> {
  const rows = await query<{
    id: string; status: BookingStatus; source: 'web' | 'manual'; guest_name: string; guest_email: string; guest_phone: string | null
    check_in: string | null; check_out: string | null; nights: number | null; guests_count: number | null; children_count: number
    pet: boolean; is_event: boolean; total_huf: number | null; notes: string | null; created_at: string
  }>(
    `select id, status, source, guest_name, guest_email, guest_phone,
            to_char(check_in, 'YYYY-MM-DD') as check_in, to_char(check_out, 'YYYY-MM-DD') as check_out,
            nights, guests_count, children_count, pet, is_event, total_huf, notes, created_at::text as created_at
       from bookings
      where listing_id = $1 and status = any($2::text[])
      order by case when status in ('pending', 'quote_request') then 0 else 1 end, coalesce(check_in, created_at::date) asc, created_at desc
      limit 300`,
    [listingId, FILTERS[filter].statuses]
  )
  return rows.map((r) => ({
    id: r.id, status: r.status, source: r.source, guestName: r.guest_name, guestEmail: r.guest_email, guestPhone: r.guest_phone,
    checkIn: r.check_in, checkOut: r.check_out, nights: r.nights, guests: r.guests_count, children: r.children_count ?? 0, pet: r.pet, isEvent: r.is_event,
    total: r.total_huf, notes: r.notes, createdAt: r.created_at,
  }))
}

export async function bookingCounts(listingId: string): Promise<Record<BookingStatus, number>> {
  const rows = await query<{ status: BookingStatus; n: number }>(
    'select status, count(*)::int as n from bookings where listing_id = $1 group by status',
    [listingId]
  )
  const out: Record<BookingStatus, number> = { quote_request: 0, pending: 0, confirmed: 0, cancelled: 0 }
  for (const r of rows) out[r.status] = r.n
  return out
}

export type OccupancyRow = { id: string; from: string; to: string; kind: 'booking' | 'manual' | 'external'; note: string | null; bookingId: string | null; guestName: string | null; status: BookingStatus | null }

export async function listOccupancy(listingId: string, from: string, to: string): Promise<OccupancyRow[]> {
  const rows = await query<{ id: string; f: string; t: string; kind: OccupancyRow['kind']; note: string | null; booking_id: string | null; guest_name: string | null; status: BookingStatus | null }>(
    `select o.id, to_char(lower(o.during), 'YYYY-MM-DD') as f, to_char(upper(o.during), 'YYYY-MM-DD') as t,
            o.kind, o.note, o.booking_id, b.guest_name, b.status
       from occupancy o left join bookings b on b.id = o.booking_id
      where o.listing_id = $1 and o.during && daterange($2::date, $3::date, '[)')
      order by lower(o.during)`,
    [listingId, from, to]
  )
  return rows.map((r) => ({ id: r.id, from: r.f, to: r.t, kind: r.kind, note: r.note, bookingId: r.booking_id, guestName: r.guest_name, status: r.status }))
}

export type AdminListing = {
  id: string; name: string; nightlyRate: number | null; pricingMode: string; tagline: string | null
  contactEmail: string | null; contactPhone: string | null
  lead: string; introBody: string; houseRules: { t: string; d: string }[]
  checkinWindow: string | null; checkoutTime: string | null; legal: LegalData
  surcharges: { code: 'single_night' | 'pet' | 'event'; label: string; amount: number; calc: 'per_stay' | 'per_night' | 'flat'; active: boolean }[]
  /** seasons: `to` is the LAST night (inclusive), as the owner thinks of it */
  seasons: { label: string; from: string; to: string; rate: number; minNights: number | null }[]
  extraGuestFrom: number | null; extraGuestHuf: number | null
}

export async function getAdminListing(listingId: string): Promise<AdminListing | null> {
  const l = await queryOne<{ id: string; name: string; nightly_rate_huf: number | null; pricing_mode: string; tagline: string | null; contact_email: string | null; contact_phone: string | null; content: { lead?: string; intro_body?: string }; house_rules: { t: string; d: string }[]; checkin_window: string | null; checkout_time: string | null; legal: unknown; extra_guest_from: number | null; extra_guest_huf: number | null }>(
    'select id, name, nightly_rate_huf, pricing_mode, tagline, contact_email, contact_phone, content, house_rules, checkin_window, checkout_time, legal, extra_guest_from, extra_guest_huf from listings where id = $1',
    [listingId]
  )
  if (!l) return null
  const s = await query<{ code: AdminListing['surcharges'][number]['code']; label: string; amount_huf: number; calc: AdminListing['surcharges'][number]['calc']; active: boolean }>(
    'select code, label, amount_huf, calc, active from listing_surcharges where listing_id = $1 order by code',
    [listingId]
  )
  const seasons = await query<{ label: string; from: string; to: string; nightly_rate_huf: number; min_nights: number | null }>(
    `select label, to_char(lower(during), 'YYYY-MM-DD') as "from", to_char(upper(during) - 1, 'YYYY-MM-DD') as "to", nightly_rate_huf, min_nights
       from listing_seasons where listing_id = $1 order by lower(during)`,
    [listingId]
  )
  return {
    seasons: seasons.map((x) => ({ label: x.label, from: x.from, to: x.to, rate: x.nightly_rate_huf, minNights: x.min_nights })),
    extraGuestFrom: l.extra_guest_from, extraGuestHuf: l.extra_guest_huf,
    id: l.id, name: l.name, nightlyRate: l.nightly_rate_huf, pricingMode: l.pricing_mode, tagline: l.tagline,
    contactEmail: l.contact_email, contactPhone: l.contact_phone,
    lead: l.content?.lead ?? '', introBody: l.content?.intro_body ?? '', houseRules: l.house_rules ?? [],
    checkinWindow: l.checkin_window, checkoutTime: l.checkout_time, legal: legalFromDb(l.legal),
    surcharges: s.map((x) => ({ code: x.code, label: x.label, amount: x.amount_huf, calc: x.calc, active: x.active })),
  }
}

// ---------- documents + versions ----------
export type AdminDoc = { body: string; effectiveDate: string | null; updatedAt: string | null }
export type DocVersion = { id: string; createdAt: string; effectiveDate: string | null; chars: number; preview: string }

export async function listDocuments(listingId: string): Promise<Partial<Record<DocKind, AdminDoc>>> {
  const rows = await query<{ kind: DocKind; body: string; effective_date: string | null; updated_at: string }>(
    `select kind, body, to_char(effective_date, 'YYYY-MM-DD') as effective_date,
            to_char(updated_at at time zone 'Europe/Budapest', 'YYYY-MM-DD HH24:MI') as updated_at
       from listing_documents where listing_id = $1`,
    [listingId]
  )
  return Object.fromEntries(rows.map((r) => [r.kind, { body: r.body, effectiveDate: r.effective_date, updatedAt: r.updated_at }]))
}

export async function listVersions(listingId: string, kind: DocKind): Promise<DocVersion[]> {
  const rows = await query<{ id: string; created_at: string; effective_date: string | null; chars: number; preview: string }>(
    `select id, to_char(created_at at time zone 'Europe/Budapest', 'YYYY-MM-DD HH24:MI') as created_at,
            to_char(effective_date, 'YYYY-MM-DD') as effective_date, length(body) as chars, left(regexp_replace(body, '\s+', ' ', 'g'), 90) as preview
       from listing_document_versions where listing_id = $1 and kind = $2 order by created_at desc limit 20`,
    [listingId, kind]
  )
  return rows.map((r) => ({ id: r.id, createdAt: r.created_at, effectiveDate: r.effective_date, chars: r.chars, preview: r.preview }))
}

// ---------- settings (social, menu, terms, bank account) ----------
export type AdminSettings = { social: SocialLinks; settings: SiteSettings; terms: Terms; bankAccount: string }

export async function getAdminSettings(listingId: string): Promise<AdminSettings | null> {
  const r = await queryOne<{ social: unknown; settings: unknown; terms: unknown; bank_account: string | null }>(
    'select social, settings, terms, bank_account from listings where id = $1',
    [listingId]
  )
  if (!r) return null
  return { social: socialFromDb(r.social), settings: settingsFromDb(r.settings), terms: termsFromDb(r.terms), bankAccount: r.bank_account ?? '' }
}

// ---------- contact messages ----------
export type AdminMessage = { id: string; name: string; email: string; phone: string | null; message: string; handled: boolean; createdAt: string }

export async function listMessages(listingId: string): Promise<AdminMessage[]> {
  const rows = await query<{ id: string; name: string; email: string; phone: string | null; message: string; handled: boolean; created_at: string }>(
    `select id, name, email, phone, message, handled, to_char(created_at at time zone 'Europe/Budapest', 'YYYY-MM-DD HH24:MI') as created_at
       from contact_messages where listing_id = $1 order by handled, created_at desc limit 100`,
    [listingId]
  )
  return rows.map((r) => ({ id: r.id, name: r.name, email: r.email, phone: r.phone, message: r.message, handled: r.handled, createdAt: r.created_at }))
}

// ---------- operations alerts (admin home "Mi a teendőd?") ----------
export type OpsAlerts = { feedErrors: { label: string; error: string }[] }

/** iCal feeds whose last sync failed (the website sends no e-mail, so nothing else can fail silently). */
export async function getOpsAlerts(listingId: string): Promise<OpsAlerts> {
  const feeds = await query<{ label: string; last_error: string }>('select label, last_error from ical_feeds where listing_id = $1 and last_error is not null', [listingId]).catch(() => [])
  return { feedErrors: feeds.map((f) => ({ label: f.label, error: f.last_error })) }
}
