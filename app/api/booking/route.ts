import { NextRequest, NextResponse, after } from 'next/server'
import { siteFromRequest } from '@/lib/site'
import { getListingId } from '@/lib/listing'
import { createBooking } from '@/lib/booking'
import { createBookingSchema } from '@/lib/booking/schemas'
import { guard, statusFor } from '@/lib/booking/http'
import { sendBookingEmails } from '@/lib/email/send'

// Booking request (status 'pending'). E-mails go out AFTER the response; a
// mail failure never loses the booking.
export async function POST(req: NextRequest) {
  const g = await guard(req, 'booking', 10)
  if (!g.ok) return g.res
  const site = siteFromRequest(req)
  const listingId = await getListingId(site).catch(() => null)
  if (!listingId) return NextResponse.json({ ok: false, reason: 'listing_not_found' }, { status: 503 })
  const result = await createBooking(listingId, g.body as Parameters<typeof createBooking>[1])
  if (result.ok && result.bookingId) {
    const d = createBookingSchema.parse(g.body)
    const nights = Math.round((Date.parse(d.checkOut) - Date.parse(d.checkIn)) / 86_400_000)
    after(() =>
      sendBookingEmails(site, listingId, {
        kind: 'booking', id: result.bookingId!, guestName: d.guestName, guestEmail: d.guestEmail, guestPhone: d.guestPhone,
        checkIn: d.checkIn, checkOut: d.checkOut, nights, guests: d.guests, pet: d.pet, isEvent: d.isEvent,
        total: result.total ?? null, message: d.message,
      })
    )
  }
  return NextResponse.json(result, { status: statusFor(result) })
}
