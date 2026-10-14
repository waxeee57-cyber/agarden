import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { queryOne } from '@/lib/db'
import { siteFromRequest } from '@/lib/site'
import { sameOrigin } from '@/lib/booking/http'
import { rateLimit, getClientIp } from '@/lib/rate-limit'
import { verifyPassword, signSession, sessionCookie } from '@/lib/admin/auth'

// Constant-cost dummy hash so an unknown e-mail takes as long as a wrong password.
const DUMMY = 'scrypt$32768$8$1$AAAAAAAAAAAAAAAAAAAAAA==$' + 'A'.repeat(86) + '=='

const schema = z.object({ email: z.email().max(200), password: z.string().min(1).max(200) })

export async function POST(req: NextRequest) {
  if (!sameOrigin(req)) return NextResponse.json({ ok: false, reason: 'forbidden' }, { status: 403 })
  const site = siteFromRequest(req)
  const ip = getClientIp(req)

  let body: unknown
  try { body = await req.json() } catch { body = null }
  const p = schema.safeParse(body)
  if (!p.success) return NextResponse.json({ ok: false, reason: 'validation_error' }, { status: 400 })
  const email = p.data.email.trim().toLowerCase()

  // DB-backed, fail CLOSED: 10 attempts / 15 min per IP, 5 / 15 min per account.
  const [ipOk, acctOk] = await Promise.all([
    rateLimit(`login:ip:${ip}`, 10, 900, true),
    rateLimit(`login:acct:${email}`, 5, 900, true),
  ])
  if (!ipOk || !acctOk) return NextResponse.json({ ok: false, reason: 'rate_limited' }, { status: 429 })

  const admin = await queryOne<{ id: string; password_hash: string; tenant_id: string; email: string; has_listing: boolean }>(
    `select a.id, a.password_hash, a.tenant_id, a.email,
            exists(select 1 from listings l where l.tenant_id = a.tenant_id and l.slug = $2 and l.status = 'active') as has_listing
       from admin_users a where lower(a.email) = $1`,
    [email, site]
  )
  const valid = await verifyPassword(p.data.password, admin?.password_hash ?? DUMMY)
  if (!admin || !valid || !admin.has_listing) {
    return NextResponse.json({ ok: false, reason: 'invalid_credentials' }, { status: 401 })
  }

  const token = await signSession({ adminId: admin.id, tenantId: admin.tenant_id, email: admin.email, site })
  const res = NextResponse.json({ ok: true })
  res.cookies.set(sessionCookie(token))
  return res
}
