import 'server-only'
import { Resend } from 'resend'
import { queryOne } from '../db'
import { siteOrigin, sisterOf, type Site } from '../site-map'
import { BRANDS } from '../brand'
import { guestEmail, ownerEmail, guestStatusEmail, type MailBooking } from './templates'

// E-mail is OPTIONAL and must never block a booking:
//   EMAIL_ENABLED=true + RESEND_API_KEY + EMAIL_FROM  -> send
//   anything missing                                  -> skip (booking is still saved)
// EMAIL_FROM is a bare address on a Resend-verified domain (foglalas@domrol.com);
// the display name is the house, so guests see "Garden Vendégház" / "Napsugár Vendégház".
// Replies never go to the sending address (it has no inbox): guest mail replies
// to the house contact e-mail, else the tenant owner; owner mail replies to the guest.

export function emailEnabled(): boolean {
  return process.env.EMAIL_ENABLED === 'true' && !!process.env.RESEND_API_KEY && !!process.env.EMAIL_FROM
}

function fromFor(site: Site): string {
  const raw = process.env.EMAIL_FROM!.trim()
  const address = raw.match(/<([^>]+)>/)?.[1] ?? raw
  return `${BRANDS[site].fullName.replace(' Velence', '')} <${address}>`
}

/** Plain-text alternative (deliverability): tags stripped, entities decoded. */
function toText(html: string): string {
  return html
    .replace(/<(br|\/p|\/tr|\/h1|\/li)[^>]*>/gi, '\n')
    .replace(/<\/td>/gi, ' ')
    .replace(/<[^>]+>/g, '')
    .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'")
    .replace(/[ \t]+/g, ' ')
    .replace(/\n\s*\n\s*/g, '\n\n')
    .trim()
}

type SendResult = { error?: { statusCode?: number | null; message: string } | null } | null

/** The SDK reports API failures in `error`, it does not throw. */
function rejected(results: SendResult[], where: string): boolean {
  const failed = results.filter((r) => r && r.error)
  if (failed.length) console.error(`[email:${where}] resend rejected`, failed.map((r) => `${r!.error!.statusCode ?? ''} ${r!.error!.message}`).join(' | '))
  return failed.length > 0
}

export async function sendBookingEmails(site: Site, listingId: string, b: MailBooking): Promise<{ sent: boolean; reason?: string }> {
  if (!emailEnabled()) return { sent: false, reason: 'disabled' }
  try {
    const l = await queryOne<{ contact_email: string | null; contact_phone: string | null; owner_email: string | null }>(
      `select l.contact_email, l.contact_phone,
              (select a.email from admin_users a where a.tenant_id = l.tenant_id and a.role = 'owner' order by a.created_at limit 1) as owner_email
         from listings l where l.id = $1`,
      [listingId]
    )
    if (!l) return { sent: false, reason: 'listing_not_found' }
    const house = { site, phone: l.contact_phone, email: l.contact_email, origin: siteOrigin(site) }
    const resend = new Resend(process.env.RESEND_API_KEY)
    const from = fromFor(site)
    const g = guestEmail(house, b)
    const o = ownerEmail(house, b)
    const houseInbox = l.contact_email ?? l.owner_email
    const results = await Promise.all([
      resend.emails.send({ from, to: b.guestEmail, subject: g.subject, html: g.html, text: toText(g.html), ...(houseInbox ? { replyTo: houseInbox } : {}) }),
      houseInbox ? resend.emails.send({ from, to: houseInbox, subject: o.subject, html: o.html, text: toText(o.html), replyTo: b.guestEmail }) : Promise.resolve(null),
    ])
    if (rejected(results, 'booking')) return { sent: false, reason: 'rejected' }
    return { sent: true }
  } catch (e) {
    console.error('[email]', e instanceof Error ? e.message : e)
    return { sent: false, reason: 'error' }
  }
}

/**
 * Owner confirmed / cancelled in /admin -> tell the guest automatically.
 * Scoped by listingId (the admin session's house), so a booking of the other
 * house can never trigger a mail. Never throws; the status change already happened.
 */
export async function sendStatusEmail(site: Site, listingId: string, bookingId: string, status: 'confirmed' | 'cancelled'): Promise<{ sent: boolean; reason?: string }> {
  if (!emailEnabled()) return { sent: false, reason: 'disabled' }
  try {
    const r = await queryOne<{
      guest_name: string; guest_email: string; guest_phone: string | null; check_in: string | null; check_out: string | null
      nights: number | null; guests_count: number | null; pet: boolean; is_event: boolean; total_huf: number | null; status: string
      contact_email: string | null; contact_phone: string | null; checkin_window: string | null; checkout_time: string | null; address: string | null
      owner_email: string | null
    }>(
      `select b.guest_name, b.guest_email, b.guest_phone, to_char(b.check_in, 'YYYY-MM-DD') as check_in, to_char(b.check_out, 'YYYY-MM-DD') as check_out,
              b.nights, b.guests_count, b.pet, b.is_event, b.total_huf, b.status,
              l.contact_email, l.contact_phone, l.checkin_window, l.checkout_time, l.address,
              (select a.email from admin_users a where a.tenant_id = l.tenant_id and a.role = 'owner' order by a.created_at limit 1) as owner_email
         from bookings b join listings l on l.id = b.listing_id
        where b.id = $1 and b.listing_id = $2`,
      [bookingId, listingId]
    )
    if (!r || r.status !== status) return { sent: false, reason: 'not_found' }
    const house = { site, phone: r.contact_phone, email: r.contact_email, origin: siteOrigin(site) }
    const sister = sisterOf(site)
    const mail = guestStatusEmail(
      house,
      {
        kind: 'booking', id: bookingId, guestName: r.guest_name, guestEmail: r.guest_email, guestPhone: r.guest_phone,
        checkIn: r.check_in, checkOut: r.check_out, nights: r.nights, guests: r.guests_count, pet: r.pet, isEvent: r.is_event, total: r.total_huf,
      },
      status,
      { checkinWindow: r.checkin_window, checkoutTime: r.checkout_time, address: r.address, sister: { name: BRANDS[sister].fullName, origin: siteOrigin(sister) } }
    )
    const houseInbox = r.contact_email ?? r.owner_email
    const res = await new Resend(process.env.RESEND_API_KEY).emails.send({
      from: fromFor(site), to: r.guest_email, subject: mail.subject, html: mail.html, text: toText(mail.html), ...(houseInbox ? { replyTo: houseInbox } : {}),
    })
    if (rejected([res], 'status')) return { sent: false, reason: 'rejected' }
    return { sent: true }
  } catch (e) {
    console.error('[email:status]', e instanceof Error ? e.message : e)
    return { sent: false, reason: 'error' }
  }
}
