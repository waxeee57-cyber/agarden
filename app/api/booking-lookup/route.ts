import { NextRequest, NextResponse } from 'next/server'
import { siteFromRequest } from '@/lib/site'
import { getListingId } from '@/lib/listing'
import { lookupBooking } from '@/lib/booking'
import { guard } from '@/lib/booking/http'

// "Foglalásom": a guest looks up their own booking (code + e-mail).
// Same-origin + DB rate limit (10 / 15 min / IP) against guessing.
export async function POST(req: NextRequest) {
  const g = await guard(req, 'booking-lookup', 10)
  if (!g.ok) return g.res
  const listingId = await getListingId(siteFromRequest(req)).catch(() => null)
  if (!listingId) return NextResponse.json({ ok: false, reason: 'unknown' }, { status: 503 })
  const r = await lookupBooking(listingId, g.body as Parameters<typeof lookupBooking>[1])
  const status = r.ok ? 200 : r.reason === 'validation_error' ? 400 : r.reason === 'not_found' ? 404 : 500
  return NextResponse.json(r, { status, headers: { 'cache-control': 'no-store' } })
}
