import { NextRequest, NextResponse, after } from 'next/server'
import { siteFromRequest } from '@/lib/site'
import { getListingId } from '@/lib/listing'
import { requestQuote } from '@/lib/booking'
import { requestQuoteSchema } from '@/lib/booking/schemas'
import { guard, statusFor } from '@/lib/booking/http'
import { sendBookingEmails } from '@/lib/email/send'

// Quote request (lead). Does not hold dates.
export async function POST(req: NextRequest) {
  const g = await guard(req, 'quote-request', 10)
  if (!g.ok) return g.res
  const site = siteFromRequest(req)
  const listingId = await getListingId(site).catch(() => null)
  if (!listingId) return NextResponse.json({ ok: false, reason: 'listing_not_found' }, { status: 503 })
  const result = await requestQuote(listingId, g.body as Parameters<typeof requestQuote>[1])
  if (result.ok && result.bookingId) {
    const d = requestQuoteSchema.parse(g.body)
    after(() =>
      sendBookingEmails(site, listingId, {
        kind: 'quote', id: result.bookingId!, guestName: d.guestName, guestEmail: d.guestEmail, guestPhone: d.guestPhone,
        checkIn: d.checkIn, checkOut: d.checkOut, guests: d.guests, pet: d.pet, isEvent: d.isEvent, message: d.message,
      })
    )
  }
  return NextResponse.json(result, { status: statusFor(result) })
}
