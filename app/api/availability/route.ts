import { NextRequest, NextResponse } from 'next/server'
import { siteFromRequest } from '@/lib/site'
import { getListingId } from '@/lib/listing'
import { getAvailability } from '@/lib/booking'

// Occupied ranges for THIS host's house. No PII, no listing id from the client.
export async function GET(req: NextRequest) {
  const listingId = await getListingId(siteFromRequest(req)).catch(() => null)
  if (!listingId) return NextResponse.json({ ok: false, reason: 'listing_not_found' }, { status: 503 })
  const sp = req.nextUrl.searchParams
  const result = await getAvailability(listingId, { from: sp.get('from') ?? '', to: sp.get('to') ?? '' })
  return NextResponse.json(result, {
    status: result.ok ? 200 : result.reason === 'validation_error' ? 400 : 503,
    headers: { 'cache-control': 'no-store' },
  })
}
