// Garden Vendeghaz — booking app layer (slice 2).
//
// Thin orchestration over the slice-1/slice-2 SECURITY DEFINER RPCs. These
// functions ONLY: (1) validate input shape (zod), (2) call the RPC, (3)
// normalize the result/error to a stable shape. The booking LOGIC (min-nights,
// overlap, surcharge math) stays in the DB — it is never re-implemented here.
//
// Least privilege: everything runs on the anon client through the definer
// RPCs. No service_role in this slice.

import { supabase } from '../supabase'
import { normalizeReason, normalizeThrown, type BookingErrorCode } from './errors'
import {
  availabilitySchema,
  quoteSchema,
  createBookingSchema,
  requestQuoteSchema,
  type AvailabilityInput,
  type QuoteInput,
  type CreateBookingInput,
  type RequestQuoteInput,
} from './schemas'

export type Surcharge = { code: string; label: string; amount: number }

export type AvailabilityResult =
  | { ok: true; ranges: { during: string; kind: string }[] }
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

export type CreateBookingResult = {
  ok: boolean
  bookingId?: string
  total?: number | null
  reason?: BookingErrorCode
}

export type RequestQuoteResult = {
  ok: boolean
  bookingId?: string
  status?: 'quote_request'
  reason?: BookingErrorCode
}

// ------------------------------------------------------------
// a) getAvailability — booked ranges only, no PII.
// ------------------------------------------------------------
export async function getAvailability(input: AvailabilityInput): Promise<AvailabilityResult> {
  const parsed = availabilitySchema.safeParse(input)
  if (!parsed.success) return { ok: false, reason: 'validation_error' }
  const { listingId, from, to } = parsed.data
  try {
    const { data, error } = await supabase.rpc('get_listing_availability', {
      p_listing_id: listingId,
      p_from: from,
      p_to: to,
    })
    if (error) return { ok: false, reason: normalizeThrown(error, 'getAvailability') }
    const ranges = (data ?? []).map((r: { during: string; kind: string }) => ({ during: r.during, kind: r.kind }))
    return { ok: true, ranges }
  } catch (e) {
    return { ok: false, reason: normalizeThrown(e, 'getAvailability') }
  }
}

// ------------------------------------------------------------
// b) getQuote — pure price breakdown (writes nothing). Calls quote_booking.
// ------------------------------------------------------------
function emptyBreakdown(reason: string): QuoteBreakdown {
  return { valid: false, reason, nights: 0, subtotal: null, surcharges: [], total: null, currency: 'HUF', pricingMode: null }
}

export async function getQuote(input: QuoteInput): Promise<QuoteBreakdown> {
  const parsed = quoteSchema.safeParse(input)
  if (!parsed.success) return emptyBreakdown('validation_error')
  const { listingId, checkIn, checkOut, pet, isEvent } = parsed.data
  try {
    const { data, error } = await supabase.rpc('quote_booking', {
      p_listing_id: listingId,
      p_check_in: checkIn,
      p_check_out: checkOut,
      p_pet: pet,
      p_is_event: isEvent,
    })
    if (error || !data) return emptyBreakdown(normalizeThrown(error, 'getQuote'))

    const surcharges: Surcharge[] = (data.applied_surcharges ?? []).map(
      (s: { code: string; label: string; amount_huf: number }) => ({ code: s.code, label: s.label, amount: s.amount_huf })
    )
    return {
      valid: !!data.valid,
      reason: data.valid ? null : normalizeReason(data.reason),
      nights: data.nights ?? 0,
      subtotal: data.subtotal_huf ?? null,
      surcharges,
      total: data.total_huf ?? null,
      currency: data.currency ?? 'HUF',
      pricingMode: data.pricing_mode ?? null,
    }
  } catch (e) {
    return emptyBreakdown(normalizeThrown(e, 'getQuote'))
  }
}

// ------------------------------------------------------------
// c) createBooking — fixed-price booking. App-level capacity check, then
//    book_listing (status 'pending'); the DB owns overlap + occupancy.
// ------------------------------------------------------------
export async function createBooking(input: CreateBookingInput): Promise<CreateBookingResult> {
  const parsed = createBookingSchema.safeParse(input)
  if (!parsed.success) return { ok: false, reason: 'validation_error' }
  const { listingId, checkIn, checkOut, guests, pet, isEvent, guestName, guestEmail, guestPhone } = parsed.data

  try {
    // App-level capacity check (data from a PII-free definer RPC so placeholders
    // — hidden from anon RLS — are still resolvable).
    const { data: meta, error: metaErr } = await supabase.rpc('get_listing_booking_meta', { p_listing_id: listingId })
    if (metaErr || !meta) return { ok: false, reason: normalizeThrown(metaErr, 'createBooking') }
    if (!meta.found) return { ok: false, reason: 'listing_not_found' }
    // Placeholder / quote-only (no fixed capacity) cannot take a fixed booking.
    if (meta.capacity_max == null) return { ok: false, reason: 'capacity_unavailable' }
    if (guests > meta.capacity_max + (meta.capacity_extra ?? 0)) return { ok: false, reason: 'capacity_unavailable' }

    const { data, error } = await supabase.rpc('book_listing', {
      p_listing_id: listingId,
      p_check_in: checkIn,
      p_check_out: checkOut,
      p_guest_name: guestName,
      p_guest_email: guestEmail,
      p_guests_count: guests,
      p_guest_phone: guestPhone ?? null,
      p_pet: pet,
      p_is_event: isEvent,
      p_notes: null,
      p_status: 'pending',
    })
    if (error || !data) return { ok: false, reason: normalizeThrown(error, 'createBooking') }
    if (!data.ok) return { ok: false, reason: normalizeReason(data.reason) }
    return { ok: true, bookingId: data.booking_id, total: data.total_huf ?? null }
  } catch (e) {
    return { ok: false, reason: normalizeThrown(e, 'createBooking') }
  }
}

// ------------------------------------------------------------
// d) requestQuote — lead capture (the brief's quote path). No price, no
//    payment, and NO occupancy block. Works for any listing (incl. #2/#3).
// ------------------------------------------------------------
export async function requestQuote(input: RequestQuoteInput): Promise<RequestQuoteResult> {
  const parsed = requestQuoteSchema.safeParse(input)
  if (!parsed.success) return { ok: false, reason: 'validation_error' }
  const { listingId, checkIn, checkOut, guests, pet, isEvent, guestName, guestEmail, guestPhone, message } = parsed.data

  try {
    const { data, error } = await supabase.rpc('request_quote', {
      p_listing_id: listingId,
      p_guest_name: guestName,
      p_guest_email: guestEmail,
      p_check_in: checkIn ?? null,
      p_check_out: checkOut ?? null,
      p_guest_phone: guestPhone ?? null,
      p_guests_count: guests ?? null,
      p_pet: pet,
      p_is_event: isEvent,
      p_message: message ?? null,
    })
    if (error || !data) return { ok: false, reason: normalizeThrown(error, 'requestQuote') }
    if (!data.ok) return { ok: false, reason: normalizeReason(data.reason) }
    return { ok: true, bookingId: data.booking_id, status: 'quote_request' }
  } catch (e) {
    return { ok: false, reason: normalizeThrown(e, 'requestQuote') }
  }
}
