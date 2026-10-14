import 'server-only'
import { randomBytes, scrypt as scryptCb, timingSafeEqual, type ScryptOptions } from 'node:crypto'
import { SignJWT, jwtVerify } from 'jose'
import { cookies } from 'next/headers'
import { NextRequest, NextResponse } from 'next/server'
import { queryOne } from '../db'
import { resolveHost, requestHost, type Site } from '../site-map'
import { sameOrigin } from '../booking/http'

// Own admin auth (Supabase Auth removed).
//  * Passwords: scrypt (N=2^15, r=8, p=1), random 16-byte salt, constant-time compare.
//  * Session: HS256 JWT in an httpOnly + Secure + SameSite=Lax cookie, 7 days.
//    The cookie has no Domain attribute, so it is bound to the exact host:
//    the Garden and Napsugár sites each need their own login.
//  * The JWT carries the site it was issued for; every check re-verifies that
//    claim against the request host AND that the host's listing belongs to the
//    admin's tenant (DB lookup), so a token can never manage another house.

export const SESSION_COOKIE = 'ag_admin'
const SESSION_DAYS = 7

const SCRYPT = { N: 1 << 15, r: 8, p: 1, keylen: 64 }

function scrypt(password: string, salt: Buffer, keylen: number, opts: ScryptOptions): Promise<Buffer> {
  return new Promise((resolve, reject) =>
    scryptCb(password, salt, keylen, opts, (err, key) => (err ? reject(err) : resolve(key)))
  )
}

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16)
  const key = await scrypt(password, salt, SCRYPT.keylen, { N: SCRYPT.N, r: SCRYPT.r, p: SCRYPT.p, maxmem: 128 * SCRYPT.N * SCRYPT.r * 2 })
  return ['scrypt', SCRYPT.N, SCRYPT.r, SCRYPT.p, salt.toString('base64'), key.toString('base64')].join('$')
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const [alg, n, r, p, saltB64, keyB64] = stored.split('$')
  if (alg !== 'scrypt' || !saltB64 || !keyB64) return false
  const expected = Buffer.from(keyB64, 'base64')
  const N = Number(n), R = Number(r), P = Number(p)
  const key = await scrypt(password, Buffer.from(saltB64, 'base64'), expected.length, { N, r: R, p: P, maxmem: 128 * N * R * 2 })
  return key.length === expected.length && timingSafeEqual(key, expected)
}

function secret(): Uint8Array {
  const s = process.env.ADMIN_SESSION_SECRET
  if (!s || s.length < 32) throw new Error('ADMIN_SESSION_SECRET missing or shorter than 32 chars')
  return new TextEncoder().encode(s)
}

export type AdminSession = { adminId: string; email: string; tenantId: string; site: Site; listingId: string; listingName: string }

export async function signSession(p: { adminId: string; tenantId: string; email: string; site: Site }): Promise<string> {
  return new SignJWT({ tid: p.tenantId, email: p.email, site: p.site })
    .setProtectedHeader({ alg: 'HS256' })
    .setSubject(p.adminId)
    .setIssuedAt()
    .setExpirationTime(`${SESSION_DAYS}d`)
    .sign(secret())
}

export function sessionCookie(token: string) {
  return {
    name: SESSION_COOKIE,
    value: token,
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax' as const,
    path: '/',
    maxAge: SESSION_DAYS * 24 * 60 * 60,
  }
}

/** Verify token for `site`: signature, expiry, site claim, admin exists, listing in admin's tenant. */
export async function verifySession(token: string | undefined, site: Site): Promise<AdminSession | null> {
  if (!token) return null
  let payload
  try {
    ;({ payload } = await jwtVerify(token, secret(), { algorithms: ['HS256'] }))
  } catch {
    return null
  }
  if (payload.site !== site || typeof payload.sub !== 'string') return null
  const row = await queryOne<{ admin_id: string; email: string; tenant_id: string; listing_id: string; listing_name: string }>(
    `select a.id as admin_id, a.email, a.tenant_id, l.id as listing_id, l.name as listing_name
       from admin_users a
       join listings l on l.tenant_id = a.tenant_id and l.slug = $2 and l.status = 'active'
      where a.id = $1`,
    [payload.sub, site]
  )
  if (!row) return null
  return { adminId: row.admin_id, email: row.email, tenantId: row.tenant_id, site, listingId: row.listing_id, listingName: row.listing_name }
}

/** Server Components / layouts: session for the current host's site, or null. */
export async function getAdminSession(site: Site): Promise<AdminSession | null> {
  return verifySession((await cookies()).get(SESSION_COOKIE)?.value, site)
}

/**
 * Route-handler guard for /api/admin/*. Resolves the site from the HOST,
 * requires a valid session for it, and same-origin on mutating methods.
 */
export async function requireAdminApi(req: NextRequest): Promise<{ ok: true; session: AdminSession } | { ok: false; res: NextResponse }> {
  const { site } = resolveHost(requestHost(req.headers))
  if (req.method !== 'GET' && req.method !== 'HEAD' && !sameOrigin(req)) {
    return { ok: false, res: NextResponse.json({ ok: false, reason: 'forbidden' }, { status: 403 }) }
  }
  const session = await verifySession(req.cookies.get(SESSION_COOKIE)?.value, site)
  if (!session) return { ok: false, res: NextResponse.json({ ok: false, reason: 'unauthorized' }, { status: 401 }) }
  return { ok: true, session }
}
