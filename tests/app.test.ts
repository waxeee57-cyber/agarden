// tests/app.test.ts — app-layer tests against the throwaway `agarden_test` DB.
//
//   pnpm test:app      (runs after scripts/test-db.mjs, which resets the DB)
//
// Run with `tsx --conditions react-server` so `import 'server-only'` resolves to
// its no-op build outside Next. Covers: host-scoped booking layer, admin auth
// (401 without session, cross-house session rejected, password hashing),
// proxy host isolation, login rate limit primitive.

import assert from 'node:assert/strict'
import { NextRequest } from 'next/server'
import { testDatabaseUrl, resetTestDatabase } from '../scripts/test-db.mjs'

process.env.DATABASE_URL = testDatabaseUrl(true)
process.env.ADMIN_SESSION_SECRET = 'test-secret-'.padEnd(48, 'x')
process.env.SITE_HOST_MAP = 'garden.test=velence,napsugar.test=napsugar'

let passed = 0
async function t(name: string, fn: () => Promise<void>) {
  await fn()
  passed++
  console.log(`  ok  ${name}`)
}

async function main() {
  await resetTestDatabase({ quiet: true })
  const { query } = await import('../lib/db')
  const booking = await import('../lib/booking')
  const { getListing, getListingId } = await import('../lib/listing')
  const auth = await import('../lib/admin/auth')
  const { rateLimit } = await import('../lib/rate-limit')
  const { proxy } = await import('../proxy')
  const { resolveHost, siteOrigin } = await import('../lib/site-map')

  const garden = (await getListingId('velence'))!
  const napsugar = (await getListingId('napsugar'))!
  console.log('app tests (agarden_test):')

  await t('host map resolves both houses; unknown host -> Garden, not "known"', async () => {
    assert.deepEqual(resolveHost('garden.test'), { site: 'velence', known: true })
    assert.deepEqual(resolveHost('napsugar.test'), { site: 'napsugar', known: true })
    assert.deepEqual(resolveHost('agarden-ten.vercel.app'), { site: 'velence', known: false })
    assert.equal(siteOrigin('napsugar'), 'https://napsugar.test')
  })

  await t('proxy: own subtree only; foreign house path -> nonexistent route; /velence 301 on Garden', async () => {
    const rw = (host: string, path: string) => {
      const res = proxy(new NextRequest(`https://${host}${path}`, { headers: { host } }))
      return { status: res.status, rewrite: res.headers.get('x-middleware-rewrite'), location: res.headers.get('location') }
    }
    assert.match(rw('garden.test', '/').rewrite ?? '', /\/velence$/)
    assert.match(rw('napsugar.test', '/aszf').rewrite ?? '', /\/napsugar\/aszf$/)
    // the other house's internal path is nested under THIS house -> [site]/napsugar does not exist -> 404
    assert.match(rw('garden.test', '/napsugar').rewrite ?? '', /\/velence\/napsugar$/)
    assert.match(rw('napsugar.test', '/velence').rewrite ?? '', /\/napsugar\/velence$/)
    const legacy = rw('garden.test', '/velence')
    assert.equal(legacy.status, 301)
    assert.match(legacy.location ?? '', /^https:\/\/garden\.test\/$/)
    const unknown = proxy(new NextRequest('https://x.vercel.app/', { headers: { host: 'x.vercel.app' } }))
    assert.equal(unknown.headers.get('x-robots-tag'), 'noindex, nofollow')
  })

  await t('napsugar listing loads with real data and no price', async () => {
    const l = (await getListing('napsugar'))!
    assert.equal(l.capacityMax + l.capacityExtra, 8)
    assert.equal(l.pricingMode, 'quote')
    assert.equal(l.nightlyRate, null)
    assert.equal(l.checkinWindow, '14:00–18:00')
    assert.ok(l.content.faq!.some((f) => f.a.includes('80 000 Ft')))
  })

  await t('napsugar quote via app layer: valid, no total (quote mode)', async () => {
    const q = await booking.getQuote(napsugar, { checkIn: '2028-05-01', checkOut: '2028-05-04', guests: 6 })
    assert.equal(q.valid, true)
    assert.equal(q.total, null)
    const tooMany = await booking.getQuote(napsugar, { checkIn: '2028-05-01', checkOut: '2028-05-04', guests: 9 })
    assert.equal(tooMany.reason, 'capacity_unavailable')
  })

  const guest = { guestName: 'Teszt Elek', guestEmail: 'teszt@example.com', guests: 4 }

  await t('booking: overlap rejected, same-day turnover allowed, min-nights + 1-night rule', async () => {
    const a = await booking.createBooking(garden, { ...guest, checkIn: '2028-07-10', checkOut: '2028-07-14' })
    assert.equal(a.ok, true)
    const clash = await booking.createBooking(garden, { ...guest, checkIn: '2028-07-13', checkOut: '2028-07-15' })
    assert.deepEqual(clash, { ok: false, reason: 'overlap' })
    const turnover = await booking.createBooking(garden, { ...guest, checkIn: '2028-07-14', checkOut: '2028-07-16' })
    assert.equal(turnover.ok, true)
    const one = await booking.createBooking(garden, { ...guest, checkIn: '2028-08-01', checkOut: '2028-08-02' })
    assert.deepEqual(one, { ok: false, reason: 'min_nights' })
  })

  await t('admin block, then booking on those dates refused', async () => {
    const s = { adminId: 'x', email: 'x', tenantId: 'x', site: 'velence' as const, listingId: garden, listingName: 'G' }
    const { createBlock } = await import('../lib/admin/actions')
    const r = await createBlock(s, { from: '2028-09-01', to: '2028-09-05', kind: 'external' })
    assert.equal(r.ok, true)
    const b = await booking.createBooking(garden, { ...guest, checkIn: '2028-09-04', checkOut: '2028-09-07' })
    assert.deepEqual(b, { ok: false, reason: 'overlap' })
  })

  await t('passwords: scrypt hash verifies, wrong password fails, hash is not plaintext', async () => {
    const h = await auth.hashPassword('correct horse battery staple')
    assert.match(h, /^scrypt\$32768\$8\$1\$/)
    assert.equal(await auth.verifyPassword('correct horse battery staple', h), true)
    assert.equal(await auth.verifyPassword('wrong', h), false)
  })

  const [{ id: adminId }] = await query<{ id: string }>(
    `insert into admin_users (email, password_hash, tenant_id) values ('owner@test.hu', $1, '11111111-1111-1111-1111-111111111111') returning id`,
    [await auth.hashPassword('pw')]
  )
  const gardenToken = await auth.signSession({ adminId, tenantId: '11111111-1111-1111-1111-111111111111', email: 'owner@test.hu', site: 'velence' })
  const req = (host: string, path: string, init: { method?: string; token?: string; origin?: string } = {}) =>
    new NextRequest(`https://${host}${path}`, {
      method: init.method ?? 'GET',
      headers: { host, ...(init.origin ? { origin: init.origin } : {}), ...(init.token ? { cookie: `${auth.SESSION_COOKIE}=${init.token}` } : {}) },
    })

  await t('/api/admin/* guard: no session -> 401', async () => {
    const r = await auth.requireAdminApi(req('garden.test', '/api/admin/me'))
    assert.equal(r.ok, false)
    if (!r.ok) assert.equal(r.res.status, 401)
  })

  await t('Garden session works on Garden host and is scoped to the Garden listing', async () => {
    const r = await auth.requireAdminApi(req('garden.test', '/api/admin/me', { token: gardenToken }))
    assert.equal(r.ok, true)
    if (r.ok) assert.equal(r.session.listingId, garden)
  })

  await t('Garden session cannot manage Napsugár (napsugar host -> 401)', async () => {
    const r = await auth.requireAdminApi(req('napsugar.test', '/api/admin/pricing', { method: 'PUT', token: gardenToken, origin: 'https://napsugar.test' }))
    assert.equal(r.ok, false)
    if (!r.ok) assert.equal(r.res.status, 401)
  })

  await t('cross-listing status change refused at the DB layer too', async () => {
    const b = await booking.createBooking(napsugar, { ...guest, checkIn: '2028-10-01', checkOut: '2028-10-04' })
    const { setBookingStatus } = await import('../lib/admin/actions')
    const s = { adminId, email: 'owner@test.hu', tenantId: 'x', site: 'velence' as const, listingId: garden, listingName: 'G' }
    const r = await setBookingStatus(s, b.bookingId!, 'cancelled')
    assert.deepEqual(r, { ok: false, reason: 'not_found' })
  })

  await t('mutating admin request from a foreign origin -> 403 (CSRF)', async () => {
    const r = await auth.requireAdminApi(req('garden.test', '/api/admin/pricing', { method: 'PUT', token: gardenToken, origin: 'https://evil.example' }))
    assert.equal(r.ok, false)
    if (!r.ok) assert.equal(r.res.status, 403)
  })

  await t('tampered / expired-signature token rejected', async () => {
    const bad = gardenToken.slice(0, -2) + (gardenToken.endsWith('a') ? 'bb' : 'aa')
    assert.equal(await auth.verifySession(bad, 'velence'), null)
  })

  await t('login rate limit: 5 per account window, 6th blocked (fail-closed primitive)', async () => {
    const res: boolean[] = []
    for (let i = 0; i < 6; i++) res.push(await rateLimit('login:acct:owner@test.hu', 5, 900, true))
    assert.deepEqual(res, [true, true, true, true, true, false])
  })

  await t("status e-mail: off when disabled; never for the other house's booking", async () => {
    const { sendStatusEmail } = await import('../lib/email/send')
    const b = await booking.createBooking(napsugar, { ...guest, checkIn: '2028-11-10', checkOut: '2028-11-13' })
    delete process.env.EMAIL_ENABLED
    assert.deepEqual(await sendStatusEmail('napsugar', napsugar, b.bookingId!, 'confirmed'), { sent: false, reason: 'disabled' })
    process.env.EMAIL_ENABLED = 'true'; process.env.RESEND_API_KEY = 're_test_not_used'; process.env.EMAIL_FROM = 'foglalas@example.invalid'
    // Garden session (listing = garden) asking about a Napsugár booking: rejected before any network call
    assert.deepEqual(await sendStatusEmail('velence', garden, b.bookingId!, 'cancelled'), { sent: false, reason: 'not_found' })
    // status must match what the DB holds (pending != confirmed) -> no mail
    assert.deepEqual(await sendStatusEmail('napsugar', napsugar, b.bookingId!, 'confirmed'), { sent: false, reason: 'not_found' })
    delete process.env.EMAIL_ENABLED; delete process.env.RESEND_API_KEY; delete process.env.EMAIL_FROM
  })

  console.log(`app tests: ${passed} passed`)
  process.exit(0)
}

main().catch((e) => {
  console.error('app tests FAILED:', e)
  process.exit(1)
})
