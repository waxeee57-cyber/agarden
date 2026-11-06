import { NextRequest, NextResponse } from 'next/server'
import { siteFromRequest } from '@/lib/site'
import { getListingId } from '@/lib/listing'
import { createBooking } from '@/lib/booking'
import { guard, statusFor } from '@/lib/booking/http'

// Booking request (status 'pending'). It lands in the admin; the website
// itself sends no e-mail (self-contained, nothing external can fail).
export async function POST(req: NextRequest) {
  const g = await guard(req, 'booking', 10)
  if (!g.ok) return g.res
  const site = siteFromRequest(req)
  const listingId = await getListingId(site).catch(() => null)
  if (!listingId) return NextResponse.json({ ok: false, reason: 'listing_not_found' }, { status: 503 })
  const result = await createBooking(listingId, g.body as Parameters<typeof createBooking>[1])
  return NextResponse.json(result, { status: statusFor(result) })
}
