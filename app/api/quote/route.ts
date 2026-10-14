import { NextRequest, NextResponse } from 'next/server'
import { siteFromRequest } from '@/lib/site'
import { getListingId } from '@/lib/listing'
import { getQuote } from '@/lib/booking'
import { guard } from '@/lib/booking/http'

// Pure price/validity check (writes nothing except the rate-limit counter).
export async function POST(req: NextRequest) {
  const g = await guard(req, 'quote', 120)
  if (!g.ok) return g.res
  const listingId = await getListingId(siteFromRequest(req)).catch(() => null)
  if (!listingId) return NextResponse.json({ valid: false, reason: 'listing_not_found' }, { status: 503 })
  const result = await getQuote(listingId, g.body as Parameters<typeof getQuote>[1])
  return NextResponse.json(result, { status: result.reason === 'validation_error' ? 400 : 200 })
}
