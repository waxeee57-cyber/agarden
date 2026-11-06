import { NextRequest, NextResponse } from 'next/server'
import { siteFromRequest } from '@/lib/site'
import { getListingId } from '@/lib/listing'
import { requestQuote } from '@/lib/booking'
import { guard, statusFor } from '@/lib/booking/http'

// Quote request (lead). Does not hold dates.
export async function POST(req: NextRequest) {
  const g = await guard(req, 'quote-request', 10)
  if (!g.ok) return g.res
  const site = siteFromRequest(req)
  const listingId = await getListingId(site).catch(() => null)
  if (!listingId) return NextResponse.json({ ok: false, reason: 'listing_not_found' }, { status: 503 })
  const result = await requestQuote(listingId, g.body as Parameters<typeof requestQuote>[1])
  return NextResponse.json(result, { status: statusFor(result) })
}
