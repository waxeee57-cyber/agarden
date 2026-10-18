import 'server-only'
import { Resend } from 'resend'
import { queryOne } from '../db'
import { siteOrigin, type Site } from '../site-map'
import { BRANDS } from '../brand'
import { guestEmail, ownerEmail, type MailBooking } from './templates'

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
    // The SDK reports API failures in `error`, it does not throw.
    const failed = results.filter((r) => r && r.error)
    if (failed.length) {
      console.error('[email] resend rejected', failed.map((r) => `${r!.error!.statusCode ?? ''} ${r!.error!.message}`).join(' | '))
      return { sent: false, reason: 'rejected' }
    }
    return { sent: true }
  } catch (e) {
    console.error('[email]', e instanceof Error ? e.message : e)
    return { sent: false, reason: 'error' }
  }
}
