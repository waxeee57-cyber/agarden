import { NextRequest, NextResponse, after } from 'next/server'
import { z } from 'zod'
import { siteFromRequest } from '@/lib/site'
import { getListingId } from '@/lib/listing'
import { queryOne } from '@/lib/db'
import { guard } from '@/lib/booking/http'
import { sendContactEmail } from '@/lib/email/send'

// Kapcsolat form. Same-origin + DB rate limit (5 / 15 min / IP). The message is
// STORED FIRST (admin "Üzenetek"), the e-mail is a best-effort notification —
// so nothing is lost while e-mail is switched off. Honeypot "website" must stay empty.
const schema = z.object({
  name: z.string().trim().min(2).max(80),
  email: z.email().max(200),
  phone: z.string().trim().max(40).optional().default(''),
  message: z.string().trim().min(5).max(2000),
  website: z.string().max(0).optional(),
})

export async function POST(req: NextRequest) {
  const g = await guard(req, 'contact', 5)
  if (!g.ok) return g.res
  const p = schema.safeParse(g.body)
  if (!p.success) {
    const fields = [...new Set(p.error.issues.map((i) => String(i.path[0])))]
    return NextResponse.json({ ok: false, reason: 'validation_error', fields }, { status: 400 })
  }
  const site = siteFromRequest(req)
  const listingId = await getListingId(site).catch(() => null)
  if (!listingId) return NextResponse.json({ ok: false, reason: 'listing_not_found' }, { status: 503 })
  const d = p.data
  await queryOne('select add_contact_message($1, $2, $3, $4, $5) as id', [listingId, d.name, d.email, d.phone, d.message])
  after(() => sendContactEmail(site, listingId, { name: d.name, email: d.email, phone: d.phone || undefined, message: d.message }))
  return NextResponse.json({ ok: true })
}
