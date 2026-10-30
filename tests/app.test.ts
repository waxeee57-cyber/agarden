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

  await t('legal data: napsugar payment terms seeded; save is scoped, validated, partial-friendly', async () => {
    const { saveLegal } = await import('../lib/admin/actions')
    const { legalFromDb, missingLegal, operatorLine, lines } = await import('../lib/legal')
    const read = async (id: string) => {
      const [r] = await query<{ legal: unknown; checkin_window: string | null; checkout_time: string | null }>(
        'select legal, checkin_window, checkout_time from listings where id = $1', [id])
      return { legal: legalFromDb(r.legal), checkinWindow: r.checkin_window, checkoutTime: r.checkout_time }
    }
    const before = await read(napsugar)
    assert.equal(lines(before.legal.paymentTerms).length, 4)
    assert.ok(before.legal.paymentTerms!.includes('80 000 Ft'))

    // bad tax number rejected, nothing written
    assert.deepEqual(await saveLegal(garden, { taxNumber: 'abc' }), { ok: false, reason: 'validation_error' })
    // partial save: only the operator block
    assert.deepEqual(await saveLegal(garden, { operatorName: 'Teszt Üzemeltető', operatorAddress: '2481 Velence, Teszt u. 1.', taxNumber: '12345678-1-07' }), { ok: true })
    const g = await read(garden)
    assert.equal(operatorLine(g.legal), 'Teszt Üzemeltető, 2481 Velence, Teszt u. 1., adószám: 12345678-1-07')
    assert.match(g.legal.updatedAt ?? '', /^\d{4}-\d{2}-\d{2}$/)
    // the form posts every field: times not sent = cleared (the admin form always sends them)
    assert.deepEqual(missingLegal(g.legal, g).map((m) => m.key), ['paymentTerms', 'cancellation', 'checkinWindow', 'checkoutTime', 'retention', 'processorsConfirmed'])
    // the other house is untouched
    assert.equal((await read(napsugar)).legal.operatorName, undefined)

    // complete save -> nothing missing; empty strings clear back to null
    const full = { operatorName: 'Teszt Üzemeltető', operatorAddress: '2481 Velence, Teszt u. 1.', taxNumber: '12345678-1-07', paymentTerms: 'a\nb', cancellation: 'c', retention: '1 év', processorsConfirmed: true, checkinWindow: '15:00–19:00', checkoutTime: '10:00' }
    assert.deepEqual(await saveLegal(garden, full), { ok: true })
    const g2 = await read(garden)
    assert.equal(missingLegal(g2.legal, g2).length, 0)
    assert.deepEqual(await saveLegal(garden, { ...full, checkoutTime: '', cancellation: '' }), { ok: true })
    const g3 = await read(garden)
    assert.equal(g3.checkoutTime, null)
    assert.equal(g3.legal.cancellation, undefined)
  })

  // ---------------- 2026-10-30: documents, settings, menu ----------------
  const actions = await import('../lib/admin/actions')
  const { normalizeSocial } = await import('../lib/social')
  const { buildNav } = await import('../lib/nav')
  const { getDocuments } = await import('../lib/listing')
  const { parseFaq, parseMarkdown } = await import('../lib/markdown')

  await t('documents: save -> live + version; restore old version; foreign version id refused', async () => {
    assert.deepEqual((await actions.saveDocument(garden, { kind: 'kornyek', body: 'első' })).ok, true)
    assert.deepEqual((await actions.saveDocument(garden, { kind: 'kornyek', body: '## Második\nszöveg' })).ok, true)
    const [old] = await query<{ id: string }>("select id from listing_document_versions where listing_id = $1 and kind = 'kornyek' and body = 'első'", [garden])
    assert.ok(old)
    assert.deepEqual((await actions.restoreDocumentVersion(garden, old.id)).ok, true)
    assert.equal((await getDocuments(garden)).kornyek?.body, 'első')
    // the Napsugár listing cannot restore (= read or write) a Garden version
    assert.deepEqual(await actions.restoreDocumentVersion(napsugar, old.id), { ok: false, reason: 'not_found' })
    assert.deepEqual(await actions.saveDocument(garden, { kind: 'nemletezo', body: 'x' }), { ok: false, reason: 'validation_error' })
  })

  await t('markdown-lite: headings/lists/links parsed, unsafe link scheme dropped, FAQ pairs', async () => {
    const b = parseMarkdown('## Cím\n- egy\n- kettő\n[x](javascript:alert(1)) és https://example.hu')
    assert.deepEqual(b.map((x) => x.t), ['h', 'ul', 'p'])
    const p = b[2] as Extract<(typeof b)[number], { t: 'p' }>
    assert.deepEqual(p.lines[0].map((i) => i.t), ['text', 'text', 'a'], 'javascript: link becomes plain text')
    assert.deepEqual(parseFaq('## K1?\nV1\n\n## K2?\nV2'), [{ q: 'K1?', a: 'V1' }, { q: 'K2?', a: 'V2' }])
  })

  await t('social links: only that network\'s domain, normalized to https; bad link rejected by field', async () => {
    assert.equal(normalizeSocial('facebook', 'facebook.com/gardenvendeghazvelence'), 'https://facebook.com/gardenvendeghazvelence')
    assert.equal(normalizeSocial('instagram', 'http://www.instagram.com/garden_vendeghaz_velence/'), 'https://www.instagram.com/garden_vendeghaz_velence/')
    assert.equal(normalizeSocial('facebook', 'https://www.instagram.com/x'), null)
    assert.equal(normalizeSocial('tiktok', 'https://tiktok.com'), null, 'bare domain is not a profile')
    assert.equal(normalizeSocial('facebook', 'https://facebook.com.evil.example/x'), null)
    const base = { menuGyik: true, menuKornyek: true, depositPct: 20, cancelDays: 30, confirmHours: 24, quoteValidDays: 4, extraCosts: [], bankAccount: '' }
    assert.deepEqual(await actions.saveSettings(garden, { ...base, social: { facebook: 'https://www.instagram.com/x' } }), { ok: false, reason: 'invalid_social', fields: ['social.facebook'] })
    assert.deepEqual(await actions.saveSettings(garden, { ...base, social: { facebook: 'facebook.com/gardenvendeghazvelence/', tiktok: '' } }), { ok: true })
    const l = (await getListing('velence'))!
    assert.deepEqual(l.social, { facebook: 'https://facebook.com/gardenvendeghazvelence/' })
  })

  await t('bank account: saved for the e-mail, never part of the public listing data', async () => {
    const base = { social: {}, menuGyik: true, menuKornyek: true, depositPct: 20, cancelDays: 30, confirmHours: 24, quoteValidDays: 4, extraCosts: [] }
    assert.equal((await actions.saveSettings(garden, { ...base, bankAccount: '<script>' })).ok, false)
    assert.deepEqual(await actions.saveSettings(garden, { ...base, bankAccount: '11773000-00000000-00000000' }), { ok: true })
    const { getListing: fresh } = await import('../lib/listing')
    const pub = JSON.stringify(await fresh('velence'))
    assert.ok(!pub.includes('11773000'), 'bank account must not reach any public page')
  })

  await t('menu toggle: GYIK hidden when switched off or empty; Környék needs text', async () => {
    const docs = { gyik: {}, hazirend: {} }
    const labels = (s: { menuGyik: boolean; menuKornyek: boolean }, d: object) => buildNav({ settings: s }, d, 'https://x.test').map((n) => n.label)
    assert.deepEqual(labels({ menuGyik: true, menuKornyek: true }, docs), ['Foglalás', 'Képek', 'Házirend', 'ÁSZF', 'Kapcsolat', 'GYIK', 'Testvérházunk'])
    assert.ok(!labels({ menuGyik: false, menuKornyek: true }, docs).includes('GYIK'))
    assert.ok(labels({ menuGyik: true, menuKornyek: true }, { ...docs, kornyek: {} }).includes('Környék & programok'))
    const base = { social: {}, menuKornyek: true, depositPct: null, cancelDays: null, confirmHours: null, quoteValidDays: null, extraCosts: [], bankAccount: '' }
    assert.deepEqual(await actions.saveSettings(napsugar, { ...base, menuGyik: false }), { ok: true })
    assert.equal((await getListing('napsugar'))!.settings.menuGyik, false)
  })

  await t('new admin endpoints: no session -> 401; Garden session on Napsugár host -> 401', async () => {
    for (const path of ['/api/admin/documents', '/api/admin/documents/restore', '/api/admin/settings', '/api/admin/messages/x']) {
      const r = await auth.requireAdminApi(req('garden.test', path, { method: 'PUT', origin: 'https://garden.test' }))
      assert.equal(!r.ok && r.res.status, 401, path)
    }
    const cross = await auth.requireAdminApi(req('napsugar.test', '/api/admin/documents', { method: 'PUT', token: gardenToken, origin: 'https://napsugar.test' }))
    assert.equal(!cross.ok && cross.res.status, 401)
  })

  console.log(`app tests: ${passed} passed`)
  process.exit(0)
}

main().catch((e) => {
  console.error('app tests FAILED:', e)
  process.exit(1)
})
