import 'server-only'
import nodemailer, { type Transporter } from 'nodemailer'
import { queryOne } from '../db'
import { siteOrigin, sisterOf, type Site } from '../site-map'
import { BRANDS } from '../brand'
import { guestEmail, ownerEmail, guestStatusEmail, contactEmail, type MailBooking } from './templates'
import { termsFromDb } from '../terms'

// E-mail at 0 Ft: plain SMTP with the house's own mailbox (Gmail + app
// password by default, ~500 recipients/day — far more than a guesthouse needs).
// It is OPTIONAL and never blocks a booking:
//   EMAIL_ENABLED=true + SMTP_USER + SMTP_PASSWORD          -> send
//   anything missing                                        -> skip (booking is still saved)
// Per house override: SMTP_USER_NAPSUGAR / SMTP_PASSWORD_NAPSUGAR (…_VELENCE).
// SMTP_HOST / SMTP_PORT default to smtp.gmail.com:465, so a cPanel box works too.
// The From address MUST be the authenticated mailbox (Gmail rewrites any other
// sender); the display name is the house. Replies go to the house inbox.

type Creds = { user: string; pass: string }

function credsFor(site: Site): Creds | null {
  const k = site.toUpperCase()
  const user = (process.env[`SMTP_USER_${k}`] ?? process.env.SMTP_USER ?? '').trim()
  const pass = (process.env[`SMTP_PASSWORD_${k}`] ?? process.env.SMTP_PASSWORD ?? '').replace(/\s+/g, '')
  return user && pass ? { user, pass } : null
}

export function emailEnabled(site?: Site): boolean {
  if (process.env.EMAIL_ENABLED !== 'true') return false
  return site ? !!credsFor(site) : !!(process.env.SMTP_USER && process.env.SMTP_PASSWORD)
}

/** Test hook: EMAIL_TRANSPORT=json captures messages here instead of sending. */
export const outbox: { from: string; to: string; replyTo?: string; subject: string; text: string }[] = []

const transports = new Map<string, Transporter>()
function transportFor(c: Creds): Transporter {
  if (process.env.EMAIL_TRANSPORT === 'json') return nodemailer.createTransport({ jsonTransport: true })
  let t = transports.get(c.user)
  if (!t) {
    const port = Number(process.env.SMTP_PORT ?? 465)
    t = nodemailer.createTransport({
      host: process.env.SMTP_HOST ?? 'smtp.gmail.com',
      port,
      secure: port === 465,
      auth: { user: c.user, pass: c.pass },
      // serverless: one short-lived connection per send, bounded waits
      connectionTimeout: 8_000, greetingTimeout: 8_000, socketTimeout: 12_000,
    })
    transports.set(c.user, t)
  }
  return t
}

type Mail = { to: string; subject: string; html: string; replyTo?: string | null }

async function deliver(site: Site, mails: Mail[], where: string): Promise<boolean> {
  const c = credsFor(site)
  if (!c) return false
  const from = { name: BRANDS[site].fullName.replace(' Velence', ''), address: c.user }
  const t = transportFor(c)
  const results = await Promise.allSettled(mails.map(async (m) => {
    const msg = { from, to: m.to, subject: m.subject, html: m.html, text: toText(m.html), ...(m.replyTo ? { replyTo: m.replyTo } : {}) }
    await t.sendMail(msg)
    if (process.env.EMAIL_TRANSPORT === 'json') outbox.push({ from: `${from.name} <${from.address}>`, to: m.to, replyTo: m.replyTo ?? undefined, subject: m.subject, text: msg.text })
  }))
  const failed = results.filter((r): r is PromiseRejectedResult => r.status === 'rejected')
  if (failed.length) console.error(`[email:${where}] smtp rejected`, failed.map((f) => (f.reason instanceof Error ? f.reason.message : String(f.reason))).join(' | '))
  return failed.length === 0
}

/** Plain-text alternative (deliverability): tags stripped, entities decoded. */
function toText(html: string): string {
  return html
    .replace(/<(br|\/p|\/tr|\/h1|\/li)[^>]*>/gi, '\n')
    .replace(/<\/td>/gi, ' ')
    .replace(/<a [^>]*href="([^"]+)"[^>]*>([^<]*)<\/a>/gi, (_, href, label) => (label && !href.includes(label) ? `${label} (${href})` : href))
    .replace(/<[^>]+>/g, '')
    .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'")
    .replace(/[ \t]+/g, ' ')
    .replace(/\n\s*\n\s*/g, '\n\n')
    .trim()
}

export async function sendBookingEmails(site: Site, listingId: string, b: MailBooking): Promise<{ sent: boolean; reason?: string }> {
  if (!emailEnabled(site)) return { sent: false, reason: 'disabled' }
  try {
    const l = await queryOne<{ contact_email: string | null; contact_phone: string | null; owner_email: string | null; terms: unknown }>(
      `select l.contact_email, l.contact_phone, l.terms,
              (select a.email from admin_users a where a.tenant_id = l.tenant_id and a.role = 'owner' order by a.created_at limit 1) as owner_email
         from listings l where l.id = $1`,
      [listingId]
    )
    if (!l) return { sent: false, reason: 'listing_not_found' }
    const house = { site, phone: l.contact_phone, email: l.contact_email, origin: siteOrigin(site), terms: termsFromDb(l.terms) }
    const g = guestEmail(house, b)
    const o = ownerEmail(house, b)
    const houseInbox = l.contact_email ?? l.owner_email ?? credsFor(site)!.user
    const ok = await deliver(site, [
      { to: b.guestEmail, subject: g.subject, html: g.html, replyTo: houseInbox },
      { to: houseInbox, subject: o.subject, html: o.html, replyTo: b.guestEmail },
    ], 'booking')
    if (!ok) return { sent: false, reason: 'rejected' }
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
  if (!emailEnabled(site)) return { sent: false, reason: 'disabled' }
  try {
    const r = await queryOne<{
      guest_name: string; guest_email: string; guest_phone: string | null; check_in: string | null; check_out: string | null
      nights: number | null; guests_count: number | null; children_count: number; pet: boolean; is_event: boolean; total_huf: number | null; status: string
      contact_email: string | null; contact_phone: string | null; checkin_window: string | null; checkout_time: string | null; address: string | null
      owner_email: string | null; terms: unknown; bank_account: string | null
    }>(
      `select b.guest_name, b.guest_email, b.guest_phone, to_char(b.check_in, 'YYYY-MM-DD') as check_in, to_char(b.check_out, 'YYYY-MM-DD') as check_out,
              b.nights, b.guests_count, b.children_count, b.pet, b.is_event, b.total_huf, b.status,
              l.contact_email, l.contact_phone, l.checkin_window, l.checkout_time, l.address, l.terms, l.bank_account,
              (select a.email from admin_users a where a.tenant_id = l.tenant_id and a.role = 'owner' order by a.created_at limit 1) as owner_email
         from bookings b join listings l on l.id = b.listing_id
        where b.id = $1 and b.listing_id = $2`,
      [bookingId, listingId]
    )
    if (!r || r.status !== status) return { sent: false, reason: 'not_found' }
    const house = { site, phone: r.contact_phone, email: r.contact_email, origin: siteOrigin(site), terms: termsFromDb(r.terms) }
    const sister = sisterOf(site)
    const mail = guestStatusEmail(
      house,
      {
        kind: 'booking', id: bookingId, guestName: r.guest_name, guestEmail: r.guest_email, guestPhone: r.guest_phone,
        checkIn: r.check_in, checkOut: r.check_out, nights: r.nights, guests: r.guests_count, children: r.children_count, pet: r.pet, isEvent: r.is_event, total: r.total_huf,
      },
      status,
      { checkinWindow: r.checkin_window, checkoutTime: r.checkout_time, address: r.address, sister: { name: BRANDS[sister].fullName, origin: siteOrigin(sister) }, bankAccount: r.bank_account }
    )
    const houseInbox = r.contact_email ?? r.owner_email
    if (!(await deliver(site, [{ to: r.guest_email, subject: mail.subject, html: mail.html, replyTo: houseInbox }], 'status'))) return { sent: false, reason: 'rejected' }
    return { sent: true }
  } catch (e) {
    console.error('[email:status]', e instanceof Error ? e.message : e)
    return { sent: false, reason: 'error' }
  }
}

/** Kapcsolat form -> the house inbox. The message is already stored (admin), so a skipped mail loses nothing. */
export async function sendContactEmail(site: Site, listingId: string, m: { name: string; email: string; phone?: string; message: string }): Promise<{ sent: boolean; reason?: string }> {
  if (!emailEnabled(site)) return { sent: false, reason: 'disabled' }
  try {
    const l = await queryOne<{ contact_email: string | null; contact_phone: string | null; owner_email: string | null }>(
      `select l.contact_email, l.contact_phone,
              (select a.email from admin_users a where a.tenant_id = l.tenant_id and a.role = 'owner' order by a.created_at limit 1) as owner_email
         from listings l where l.id = $1`,
      [listingId]
    )
    const inbox = l?.contact_email ?? l?.owner_email ?? credsFor(site)?.user
    if (!l || !inbox) return { sent: false, reason: 'no_inbox' }
    const mail = contactEmail({ site, phone: l.contact_phone, email: l.contact_email, origin: siteOrigin(site) }, m)
    if (!(await deliver(site, [{ to: inbox, subject: mail.subject, html: mail.html, replyTo: m.email }], 'contact'))) return { sent: false, reason: 'rejected' }
    return { sent: true }
  } catch (e) {
    console.error('[email:contact]', e instanceof Error ? e.message : e)
    return { sent: false, reason: 'error' }
  }
}
