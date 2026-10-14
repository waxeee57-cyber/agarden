import 'server-only'
import { Resend } from 'resend'
import { queryOne } from '../db'
import { siteOrigin, type Site } from '../site-map'
import { guestEmail, ownerEmail, type MailBooking } from './templates'

// E-mail is OPTIONAL and must never block a booking:
//   EMAIL_ENABLED=true + RESEND_API_KEY + EMAIL_FROM  -> send
//   anything missing                                  -> skip (booking is still saved)
// EMAIL_FROM needs a Resend-verified sender domain (owner TODO).
// Owner notifications go to the listing contact e-mail, else to the tenant owner.

export function emailEnabled(): boolean {
  return process.env.EMAIL_ENABLED === 'true' && !!process.env.RESEND_API_KEY && !!process.env.EMAIL_FROM
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
    const from = process.env.EMAIL_FROM!
    const g = guestEmail(house, b)
    const o = ownerEmail(house, b)
    const ownerTo = l.contact_email ?? l.owner_email
    await Promise.all([
      resend.emails.send({ from, to: b.guestEmail, subject: g.subject, html: g.html, ...(l.contact_email ? { replyTo: l.contact_email } : {}) }),
      ownerTo ? resend.emails.send({ from, to: ownerTo, subject: o.subject, html: o.html, replyTo: b.guestEmail }) : Promise.resolve(),
    ])
    return { sent: true }
  } catch (e) {
    console.error('[email]', e instanceof Error ? e.message : e)
    return { sent: false, reason: 'error' }
  }
}
