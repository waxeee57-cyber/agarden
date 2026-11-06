import 'server-only'
import { queryOne } from '../db'
import { siteOrigin, sisterOf, type Site } from '../site-map'
import { BRANDS } from '../brand'
import { termsFromDb } from '../terms'
import { guestEmail, guestStatusEmail, type MailBooking, type MailHouse, type StatusExtras } from './templates'
import type { AdminBooking } from '../admin/data'

// Self-contained e-mail: the website sends NOTHING itself (no SMTP, no API,
// no third party). Every booking lands in the admin; for each one the admin
// offers a ready-written message that opens in the owner's OWN mail app
// (mailto:) — the owner's mailbox is the only sender, 0 Ft, nothing to fail.

export type GuestMail = { href: string; label: string }

type Ctx = { house: MailHouse; extras: StatusExtras }

export async function mailContext(site: Site, listingId: string): Promise<Ctx | null> {
  const l = await queryOne<{ contact_email: string | null; contact_phone: string | null; terms: unknown; checkin_window: string | null; checkout_time: string | null; address: string | null }>(
    'select contact_email, contact_phone, terms, checkin_window, checkout_time, address from listings where id = $1',
    [listingId]
  )
  if (!l) return null
  const sister = sisterOf(site)
  return {
    house: { site, phone: l.contact_phone, email: l.contact_email, origin: siteOrigin(site), terms: termsFromDb(l.terms) },
    extras: { checkinWindow: l.checkin_window, checkoutTime: l.checkout_time, address: l.address, sister: { name: BRANDS[sister].fullName, origin: siteOrigin(sister) } },
  }
}

/** Plain text for mail clients (mailto bodies are text only). */
export function toText(html: string): string {
  return html
    .replace(/<(br|\/p|\/tr|\/h1|\/li)[^>]*>/gi, '\n')
    .replace(/<\/td>/gi, ' ')
    .replace(/<a [^>]*href="([^"]+)"[^>]*>([^<]*)<\/a>/gi, (_, href, label) => (label && !href.includes(label) ? `${label} (${href})` : href))
    .replace(/<[^>]+>/g, '')
    .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'")
    .replace(/[ \t]+/g, ' ')
    .replace(/ *\n */g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

const mailto = (to: string, subject: string, body: string) =>
  `mailto:${encodeURIComponent(to)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`

/** The message that fits the booking's current state, ready in the owner's mail app. */
export function guestMailFor(ctx: Ctx, b: AdminBooking): GuestMail {
  const mb: MailBooking = {
    kind: b.status === 'quote_request' ? 'quote' : 'booking', id: b.id, guestName: b.guestName, guestEmail: b.guestEmail, guestPhone: b.guestPhone,
    checkIn: b.checkIn, checkOut: b.checkOut, nights: b.nights, guests: b.guests, children: b.children, pet: b.pet, isEvent: b.isEvent, total: b.total,
  }
  if (b.status === 'confirmed' || b.status === 'cancelled') {
    const m = guestStatusEmail(ctx.house, mb, b.status, ctx.extras)
    return { href: mailto(b.guestEmail, m.subject, toText(m.html)), label: b.status === 'confirmed' ? 'Visszaigazoló e-mail' : 'Lemondó e-mail' }
  }
  const m = guestEmail(ctx.house, mb)
  return { href: mailto(b.guestEmail, m.subject, toText(m.html)), label: 'Visszajelző e-mail' }
}
