import { NextRequest, NextResponse } from 'next/server'
import { siteFromRequest, siteOrigin, sisterOf } from '@/lib/site'
import { getListingId } from '@/lib/listing'
import { isFree } from '@/lib/booking'

const ISO = /^\d{4}-\d{2}-\d{2}$/

// Is the OTHER house free for [checkIn, checkOut)? Returns only a boolean and
// a deep link to the sister's own domain — never its occupancy details.
export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams
  const checkIn = sp.get('checkIn') ?? ''
  const checkOut = sp.get('checkOut') ?? ''
  if (!ISO.test(checkIn) || !ISO.test(checkOut) || checkOut <= checkIn) {
    return NextResponse.json({ ok: false, reason: 'validation_error' }, { status: 400 })
  }
  const sister = sisterOf(siteFromRequest(req))
  try {
    const listingId = await getListingId(sister)
    if (!listingId) return NextResponse.json({ ok: true, free: false })
    const free = await isFree(listingId, checkIn, checkOut)
    const href = `${siteOrigin(sister)}/foglalas?checkIn=${checkIn}&checkOut=${checkOut}`
    return NextResponse.json({ ok: true, free, ...(free ? { href } : {}) }, { headers: { 'cache-control': 'no-store' } })
  } catch {
    return NextResponse.json({ ok: false, reason: 'unknown' }, { status: 503 })
  }
}
