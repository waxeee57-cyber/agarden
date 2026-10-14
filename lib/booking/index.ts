import 'server-only'

// Booking app layer — thin orchestration over the SQL functions in
// db/migrations/02–03. These functions ONLY validate input shape (zod), call
// the DB function, and normalize the result to a stable shape. Booking LOGIC
// (min-nights, overlap, surcharge math) stays in Postgres.
//
// Every function takes the listingId resolved from the request HOST
// (lib/site.ts) — a client can never choose which house it books.

import { query, queryOne } from '../db'
import { normalizeReason, normalizeThrown, type BookingErrorCode } from './errors'
import {
  availabilitySchema, quoteSchema, createBookingSchema, requestQuoteSchema,
  type AvailabilityInput, type QuoteInput, type CreateBookingInput, type RequestQuoteInput,
} from './schemas'

export type Surcharge = { code: string; label: string; amount: number }

export type AvailabilityResult =
  | { ok: true; ranges: { from: string; to: string; kind: string }[] }
  | { ok: false; reason: BookingErrorCode }

export type QuoteBreakdown = {
  valid: boolean
  reason: string | null
  nights: number
  subtotal: number | null
  surcharges: Surcharge[]
  total: number | null
  currency: string
  pricingMode: string | null
}

export type CreateBookingResult = { ok: boolean; bookingId?: string; total?: number | null; reason?: BookingErrorCode }
export type RequestQuoteResult = { ok: boolean; bookingId?: string; status?: 'quote_request'; reason?: BookingErrorCode }

type Json = Record<string, unknown>

// daterange text "[2027-07-10,2027-07-14)" -> { from, to } (to exclusive)
function parseRange(r: string): { from: string; to: string } | null {
  const m = r.match(/(\d{4}-\d{2}-\d{2}),(\d{4}-\d{2}-\d{2})/)
  return m ? { from: m[1], to: m[2] } : null
}

export async function getAvailability(listingId: string, input: AvailabilityInput): Promise<AvailabilityResult> {
  const parsed = availabilitySchema.safeParse(input)
  if (!parsed.success || parsed.data.to <= parsed.data.from) return { ok: false, reason: 'validation_error' }
  try {
    const rows = await query<{ during: string; kind: string }>(
      'select during::text as during, kind from get_listing_availability($1, $2, $3)',
      [listingId, parsed.data.from, parsed.data.to]
    )
    const ranges = rows.flatMap((r) => {
      const p = parseRange(r.during)
      return p ? [{ ...p, kind: r.kind }] : []
    })
    return { ok: true, ranges }
  } catch (e) {
    return { ok: false, reason: normalizeThrown(e, 'getAvailability') }
  }
}

/** True when [checkIn, checkOut) has no occupancy on the listing. */
export async function isFree(listingId: string, checkIn: string, checkOut: string): Promise<boolean> {
  const row = await queryOne<{ taken: boolean }>(
    `select exists (select 1 from occupancy where listing_id = $1 and during && daterange($2::date, $3::date, '[)')) as taken`,
    [listingId, checkIn, checkOut]
  )
  return row ? !row.taken : false
}

function emptyBreakdown(reason: string): QuoteBreakdown {
  return { valid: false, reason, nights: 0, subtotal: null, surcharges: [], total: null, currency: 'HUF', pricingMode: null }
}

export async function getQuote(listingId: string, input: QuoteInput): Promise<QuoteBreakdown> {
  const parsed = quoteSchema.safeParse(input)
  if (!parsed.success) return emptyBreakdown('validation_error')
  const { checkIn, checkOut, pet, isEvent, guests } = parsed.data
  try {
    const cap = await capacityCheck(listingId, guests)
    if (cap) return emptyBreakdown(cap)
    const row = await queryOne<{ r: Json }>('select quote_booking($1, $2, $3, $4, $5) as r', [listingId, checkIn, checkOut, pet, isEvent])
    const data = row?.r
    if (!data) return emptyBreakdown('unknown')
    const applied = (data.applied_surcharges as { code: string; label: string; amount_huf: number }[] | undefined) ?? []
    return {
      valid: !!data.valid,
      reason: data.valid ? null : normalizeReason(data.reason),
      nights: (data.nights as number) ?? 0,
      subtotal: (data.subtotal_huf as number | null) ?? null,
      surcharges: applied.map((s) => ({ code: s.code, label: s.label, amount: s.amount_huf })),
      total: (data.total_huf as number | null) ?? null,
      currency: 'HUF',
      pricingMode: (data.pricing_mode as string) ?? null,
    }
  } catch (e) {
    return emptyBreakdown(normalizeThrown(e, 'getQuote'))
  }
}

async function capacityCheck(listingId: string, guests: number): Promise<BookingErrorCode | null> {
  const meta = await queryOne<{ capacity_max: number | null; capacity_extra: number | null }>(
    `select capacity_max, capacity_extra from listings where id = $1 and status = 'active'`,
    [listingId]
  )
  if (!meta) return 'listing_not_found'
  if (meta.capacity_max == null) return 'capacity_unavailable'
  if (guests > meta.capacity_max + (meta.capacity_extra ?? 0)) return 'capacity_unavailable'
  return null
}

/** Booking request: status 'pending', dates held until the owner confirms or cancels. */
export async function createBooking(
  listingId: string,
  input: CreateBookingInput,
  opts: { status?: 'pending' | 'confirmed'; source?: 'web' | 'manual' } = {}
): Promise<CreateBookingResult> {
  const parsed = createBookingSchema.safeParse(input)
  if (!parsed.success) return { ok: false, reason: 'validation_error' }
  const d = parsed.data
  try {
    const cap = await capacityCheck(listingId, d.guests)
    if (cap) return { ok: false, reason: cap }
    const row = await queryOne<{ r: Json }>(
      'select book_listing($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12) as r',
      [listingId, d.checkIn, d.checkOut, d.guestName, d.guestEmail, d.guests, d.guestPhone ?? null,
        d.pet, d.isEvent, d.message ?? null, opts.status ?? 'pending', opts.source ?? 'web']
    )
    const data = row?.r
    if (!data) return { ok: false, reason: 'unknown' }
    if (!data.ok) return { ok: false, reason: normalizeReason(data.reason) }
    return { ok: true, bookingId: data.booking_id as string, total: (data.total_huf as number | null) ?? null }
  } catch (e) {
    return { ok: false, reason: normalizeThrown(e, 'createBooking') }
  }
}

/** Quote request (lead): no price, no payment, does NOT hold dates. */
export async function requestQuote(listingId: string, input: RequestQuoteInput): Promise<RequestQuoteResult> {
  const parsed = requestQuoteSchema.safeParse(input)
  if (!parsed.success) return { ok: false, reason: 'validation_error' }
  const d = parsed.data
  try {
    const row = await queryOne<{ r: Json }>(
      'select request_quote($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) as r',
      [listingId, d.guestName, d.guestEmail, d.checkIn ?? null, d.checkOut ?? null, d.guestPhone ?? null,
        d.guests ?? null, d.pet, d.isEvent, d.message ?? null]
    )
    const data = row?.r
    if (!data) return { ok: false, reason: 'unknown' }
    if (!data.ok) return { ok: false, reason: normalizeReason(data.reason) }
    return { ok: true, bookingId: data.booking_id as string, status: 'quote_request' }
  } catch (e) {
    return { ok: false, reason: normalizeThrown(e, 'requestQuote') }
  }
}
