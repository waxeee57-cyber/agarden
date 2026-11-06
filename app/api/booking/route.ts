import { NextRequest, NextResponse } from 'next/server'
import { siteFromRequest } from '@/lib/site'
import { getListingId } from '@/lib/listing'
import { createBooking, paymentInfo } from '@/lib/booking'
import { guard, statusFor } from '@/lib/booking/http'

// Instant booking: valid dates are confirmed on the spot (book_listing checks
// availability, min nights and overlap atomically; the exclusion constraint
// makes a simultaneous double booking impossible). The guest gets the final
// status, code and payment details in this response and later behind code +
// e-mail (/foglalasom). No owner action, no outbound e-mail, nothing external.
export async function POST(req: NextRequest) {
  const g = await guard(req, 'booking', 10)
  if (!g.ok) return g.res
  const site = siteFromRequest(req)
  const listingId = await getListingId(site).catch(() => null)
  if (!listingId) return NextResponse.json({ ok: false, reason: 'listing_not_found' }, { status: 503 })
  const result = await createBooking(listingId, g.body as Parameters<typeof createBooking>[1], { status: 'confirmed' })
  if (!result.ok || !result.bookingId) return NextResponse.json(result, { status: statusFor(result), headers: { 'cache-control': 'no-store' } })
  const payment = await paymentInfo(listingId, result.bookingId, result.total ?? null)
  return NextResponse.json({ ...result, status: 'confirmed', payment }, { headers: { 'cache-control': 'no-store' } })
}
