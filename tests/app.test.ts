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
    const base = { menuGyik: true, menuKornyek: true, cancelDays: 30, confirmHours: 24, quoteValidDays: 4, extraCosts: [] }
    assert.deepEqual(await actions.saveSettings(garden, { ...base, social: { facebook: 'https://www.instagram.com/x' } }), { ok: false, reason: 'invalid_social', fields: ['social.facebook'] })
    assert.deepEqual(await actions.saveSettings(garden, { ...base, social: { facebook: 'facebook.com/gardenvendeghazvelence/', tiktok: '' } }), { ok: true })
    const l = (await getListing('velence'))!
    assert.deepEqual(l.social, { facebook: 'https://facebook.com/gardenvendeghazvelence/' })
  })

  await t('cash on site: no deposit/bank setting is stored, old clients cannot sneak one in', async () => {
    const base = { social: {}, menuGyik: true, menuKornyek: true, cancelDays: 30, confirmHours: 24, quoteValidDays: 4, extraCosts: [] }
    assert.deepEqual(await actions.saveSettings(garden, { ...base, depositPct: 20, bankAccount: '11773000-00000000-00000000' }), { ok: true })
    const [row] = await query<{ terms: Record<string, unknown> }>('select terms from listings where id = $1', [garden])
    assert.ok(!('deposit_pct' in row!.terms), 'no deposit stored')
    assert.ok(!JSON.stringify(await query('select * from listings where id = $1', [garden])).includes('11773000'), 'no bank account stored anywhere on the listing')
    const { paymentLine, termsFromDb } = await import('../lib/terms')
    assert.match(paymentLine(termsFromDb(row!.terms)), /helyszínen, készpénzben.*30 napig díjmentesen/)
  })

  await t('menu toggle: GYIK hidden when switched off or empty; Környék needs text', async () => {
    const docs = { gyik: {}, hazirend: {} }
    const labels = (s: { menuGyik: boolean; menuKornyek: boolean }, d: object) => buildNav({ settings: s }, d, 'https://x.test').map((n) => n.label)
    assert.deepEqual(labels({ menuGyik: true, menuKornyek: true }, docs), ['A ház', 'Foglalás', 'Képek', 'Házirend', 'ÁSZF', 'Kapcsolat', 'Foglalásom', 'GYIK', 'Testvérházunk'])
    assert.ok(!labels({ menuGyik: false, menuKornyek: true }, docs).includes('GYIK'))
    assert.ok(labels({ menuGyik: true, menuKornyek: true }, { ...docs, kornyek: {} }).includes('Környék & programok'))
    const base = { social: {}, menuKornyek: true, cancelDays: null, confirmHours: null, quoteValidDays: null, extraCosts: [] }
    assert.deepEqual(await actions.saveSettings(napsugar, { ...base, menuGyik: false }), { ok: true })
    assert.equal((await getListing('napsugar'))!.settings.menuGyik, false)
  })

  await t('children + "Foglalásom" lookup: code + e-mail only, same answer for wrong code or e-mail, house-scoped', async () => {
    const b = await booking.createBooking(garden, { guestName: 'Kis Anna', guestEmail: 'Anna@Example.com', guests: 5, children: 2, checkIn: '2027-03-05', checkOut: '2027-03-08' })
    assert.ok(b.ok && b.bookingId, JSON.stringify(b))
    const code = b.bookingId!.slice(0, 8).toUpperCase()
    const hit = await booking.lookupBooking(garden, { code, email: 'anna@example.com' })
    assert.ok(hit.ok)
    if (hit.ok) {
      assert.equal(hit.booking.code, code)
      assert.equal(hit.booking.children, 2)
      assert.equal(hit.booking.guests, 5)
      assert.equal(hit.booking.status, 'pending')
      assert.equal(hit.booking.checkIn, '2027-03-05')
      assert.ok(!('guestEmail' in hit.booking) && !('guestName' in hit.booking), 'no personal data echoed')
    }
    assert.deepEqual(await booking.lookupBooking(garden, { code, email: 'masik@example.com' }), { ok: false, reason: 'not_found' })
    assert.deepEqual(await booking.lookupBooking(garden, { code: '00000000', email: 'anna@example.com' }), { ok: false, reason: 'not_found' })
    assert.deepEqual(await booking.lookupBooking(napsugar, { code, email: 'anna@example.com' }), { ok: false, reason: 'not_found' }, 'other house cannot see it')
    assert.deepEqual(await booking.lookupBooking(garden, { code: "x' or 1=1", email: 'anna@example.com' } as never), { ok: false, reason: 'validation_error' })
    // children never exceed the head count
    const c = await booking.createBooking(garden, { guestName: 'Kis Béla', guestEmail: 'bela@example.com', guests: 2, children: 9, checkIn: '2027-04-05', checkOut: '2027-04-08' })
    const rows = await query<{ children_count: number }>('select children_count from bookings where id = $1', [c.bookingId])
    assert.equal(rows[0].children_count, 2)
  })

  await t('/api/ics: valid calendar file from public data only; bad params -> 400', async () => {
    const { GET } = await import('../app/api/ics/route')
    const ok = await GET(new NextRequest('https://garden.test/api/ics?checkIn=2029-03-05&checkOut=2029-03-08&kod=abcd1234', { headers: { host: 'garden.test' } }))
    assert.equal(ok.status, 200)
    assert.match(ok.headers.get('content-type') ?? '', /^text\/calendar/)
    const body = await ok.text()
    assert.match(body, /^BEGIN:VCALENDAR\r\n/)
    assert.match(body, /DTSTART;VALUE=DATE:20290305\r\n/)
    assert.match(body, /DTEND;VALUE=DATE:20290308\r\n/)
    assert.match(body, /ABCD1234/)
    assert.ok(body.split('\r\n').every((l) => new TextEncoder().encode(l).length <= 75), 'lines folded at 75 octets')
    assert.ok(!body.includes('11773000'), 'no bank account')
    for (const q of ['checkIn=2029-03-08&checkOut=2029-03-05', 'checkIn=x&checkOut=2029-03-05', 'checkIn=2029-03-05&checkOut=2029-03-08&kod=%3Cscript%3E']) {
      const bad = await GET(new NextRequest(`https://garden.test/api/ics?${q}`, { headers: { host: 'garden.test' } }))
      assert.equal(bad.status, 400, q)
    }
  })

  await t('seasons + headcount surcharge: every night priced on its own, arrival-season min nights, admin save validated', async () => {
    const actions = await import('../lib/admin/actions')
    const s = { site: 'velence', listingId: garden } as never
    const base = { nightlyRate: 60000, surcharges: [], extraGuestFrom: 8, extraGuestHuf: 5000 }
    assert.deepEqual(await actions.updatePricing(s, { ...base, seasons: [
      { label: 'Főszezon', from: '2027-07-01', to: '2027-08-31', rate: 90000, minNights: 3 },
      { label: 'Átfedő', from: '2027-08-31', to: '2027-09-05', rate: 70000, minNights: null },
    ] }), { ok: false, reason: 'season_overlap' })
    assert.deepEqual(await actions.updatePricing(s, { ...base, seasons: [{ label: 'Főszezon', from: '2027-07-01', to: '2027-08-31', rate: 90000, minNights: 3 }] }), { ok: true })
    const q = await booking.getQuote(garden, { checkIn: '2027-06-28', checkOut: '2027-07-03', guests: 10 })
    assert.equal(q.valid, true)
    assert.deepEqual(q.breakdown, [{ label: 'Alapár', nights: 3, rate: 60000 }, { label: 'Főszezon', nights: 2, rate: 90000 }])
    assert.equal(q.subtotal, 360000)
    assert.ok(q.surcharges.some((x) => x.code === 'extra_guest' && x.amount === 2 * 5000 * 5))
    assert.equal(q.total, 410000)
    // last night of the season is Aug 31 (inclusive): Aug 30 -> Sep 2 = 2 season nights + 1 base night
    const edge = await booking.getQuote(garden, { checkIn: '2027-08-30', checkOut: '2027-09-02', guests: 4 })
    assert.deepEqual(edge.breakdown, [{ label: 'Főszezon', nights: 2, rate: 90000 }, { label: 'Alapár', nights: 1, rate: 60000 }])
    assert.equal((await booking.getQuote(garden, { checkIn: '2027-07-10', checkOut: '2027-07-12', guests: 4 })).reason, 'min_nights')
    const b = await booking.createBooking(garden, { guestName: 'Szezon Teszt', guestEmail: 'sz@example.com', guests: 4, checkIn: '2027-07-10', checkOut: '2027-07-13' })
    assert.equal(b.total, 270000, 'stored total = SQL quote')
    // back to quote-only so other tests see the seeded state
    assert.deepEqual(await actions.updatePricing(s, { nightlyRate: null, surcharges: [], seasons: [], extraGuestFrom: null, extraGuestHuf: null }), { ok: true })
    assert.equal((await getListing('velence'))!.pricingMode, 'quote')
  })

  await t('iCal: parse folded/datetime/cancelled events; export has dates only; import blocks days and never overwrites our bookings', async () => {
    const ical = await import('../lib/ical')
    const ics = ['BEGIN:VCALENDAR', 'BEGIN:VEVENT', 'DTSTART;VALUE=DATE:20280301', 'DTEND;VALUE=DATE:20280304', 'SUMMARY:Airbnb (Not avail', ' able)', 'END:VEVENT',
      'BEGIN:VEVENT', 'DTSTART:20280310T140000Z', 'DTEND:20280312T100000Z', 'END:VEVENT',
      'BEGIN:VEVENT', 'DTSTART;VALUE=DATE:20280320', 'STATUS:CANCELLED', 'END:VEVENT',
      'BEGIN:VEVENT', 'DTSTART;VALUE=DATE:20280401', 'END:VEVENT', 'END:VCALENDAR'].join('\r\n')
    assert.deepEqual(ical.parseIcs(ics), [{ from: '2028-03-01', to: '2028-03-04' }, { from: '2028-03-10', to: '2028-03-12' }, { from: '2028-04-01', to: '2028-04-02' }])
    // our booking 2028-03-02..05 collides with the first external range -> that range is skipped
    await booking.createBooking(napsugar, { guestName: 'Ical Teszt', guestEmail: 'ic@example.com', guests: 2, checkIn: '2028-03-02', checkOut: '2028-03-05' })
    const http = await import('node:http')
    const srv = http.createServer((_q, r) => { r.writeHead(200, { 'content-type': 'text/calendar' }); r.end(ics) })
    await new Promise<void>((ok) => srv.listen(0, ok))
    const url = `http://127.0.0.1:${(srv.address() as { port: number }).port}/cal.ics`
    const feed = (await query<{ id: string; listing_id: string; url: string }>(`insert into ical_feeds (listing_id, label, url) values ($1, 'Airbnb', 'https://x.invalid/a.ics') returning id, listing_id, $2::text as url`, [napsugar, url]))[0]
    const r1 = await ical.syncFeed(feed)
    assert.equal(r1.ok, true); assert.equal(r1.count, 2)
    // the skipped range is recorded as a clash with OUR pending request, not dropped silently
    assert.equal(r1.conflicts?.length, 1)
    assert.deepEqual({ ...r1.conflicts![0], code: undefined }, { from: '2028-03-01', to: '2028-03-04', code: undefined, status: 'pending', kind: 'booking' })
    assert.match(r1.conflicts![0].code!, /^[0-9A-F]{8}$/)
    const r2 = await ical.syncFeed(feed) // idempotent: replaces its own rows
    assert.equal(r2.count, 2); assert.equal(r2.conflicts?.length, 1)
    const { getOpsAlerts } = await import('../lib/admin/data')
    const ops = await getOpsAlerts(napsugar)
    assert.equal(ops.icalConflicts.length, 1, 'admin sees the clash')
    assert.equal(ops.icalConflicts[0].label, 'Airbnb')
    srv.close()
    const ext = await query<{ during: string }>(`select during::text from occupancy where feed_id = $1 order by during`, [feed.id])
    assert.deepEqual(ext.map((x) => x.during), ['[2028-03-10,2028-03-12)', '[2028-04-01,2028-04-02)'])
    const bad = await ical.syncFeed({ ...feed, url: 'http://127.0.0.1:9/none.ics' })
    assert.equal(bad.ok, false)
    // export: token-gated, dates only, external rows not echoed back
    const tok = (await ical.icalToken(napsugar))!
    assert.match(tok, /^[0-9a-f]{64}$/)
    const out = (await ical.exportFor(tok))!
    assert.match(out.ics, /DTSTART;VALUE=DATE:20280302\r\nDTEND;VALUE=DATE:20280305/)
    assert.ok(!out.ics.includes('20280310'), 'imported range not re-exported')
    assert.ok(!/Ical Teszt|ic@example/.test(out.ics), 'no guest data')
    assert.equal(await ical.exportFor('0'.repeat(64)), null)
    assert.equal(await ical.exportFor("x' or 1=1"), null)
  })

  await t('edge guards: past arrival (Budapest day), > 2 years ahead, > 90 nights; booking API refuses them too', async () => {
    const day = (n: number) => { const d = new Date(Date.now() + n * 86_400_000); return d.toLocaleDateString('sv-SE', { timeZone: 'Europe/Budapest' }) }
    assert.equal((await booking.getQuote(garden, { checkIn: day(-1), checkOut: day(2), guests: 2 })).reason, 'past_dates')
    assert.equal((await booking.getQuote(garden, { checkIn: day(0), checkOut: day(2), guests: 2 })).valid, true, 'arriving today (Budapest) is fine')
    assert.equal((await booking.getQuote(garden, { checkIn: day(800), checkOut: day(803), guests: 2 })).reason, 'too_far')
    assert.equal((await booking.getQuote(garden, { checkIn: day(10), checkOut: day(101), guests: 2 })).reason, 'too_long')
    const past = await booking.createBooking(garden, { guestName: 'Múlt Teszt', guestEmail: 'm@example.com', guests: 2, checkIn: day(-3), checkOut: day(-1) })
    assert.deepEqual(past, { ok: false, reason: 'past_dates' })
  })

  await t('cron: with CRON_SECRET only the bearer passes; without it, at most one run per 10 minutes', async () => {
    const { GET } = await import('../app/api/cron/ical/route')
    const call = (auth?: string) => GET(new NextRequest('https://garden.test/api/cron/ical', { headers: { host: 'garden.test', ...(auth ? { authorization: auth } : {}) } }))
    process.env.CRON_SECRET = 'x'.repeat(40)
    assert.equal((await call()).status, 401)
    assert.equal((await call('Bearer nope')).status, 401)
    assert.equal((await call(`Bearer ${'x'.repeat(40)}`)).status, 200)
    delete process.env.CRON_SECRET
    const first = await (await call()).json(); const second = await (await call()).json()
    assert.equal(first.done, true); assert.equal(second.skipped, 'throttled')
  })

  await t('request-based: a web booking is always a pending request (never auto-confirmed), logged for the owner', async () => {
    const { POST } = await import('../app/api/booking/route')
    const body = { guestName: 'Kérelem Teszt', guestEmail: 'kerelem@example.com', guests: 2, checkIn: '2027-11-10', checkOut: '2027-11-13', status: 'confirmed' }
    const res = await POST(new NextRequest('https://napsugar.test/api/booking', { method: 'POST', body: JSON.stringify(body), headers: { host: 'napsugar.test', origin: 'https://napsugar.test', 'content-type': 'application/json', 'x-forwarded-for': '10.9.9.9' } }))
    const j = await res.json()
    assert.equal(res.status, 200, JSON.stringify(j)); assert.equal(j.ok, true)
    const [b] = await query<{ status: string }>('select status from bookings where id = $1', [j.bookingId])
    assert.equal(b.status, 'pending', 'client cannot ask for confirmed')
    const ev = await query<{ event: string }>('select event from booking_events where booking_id = $1', [j.bookingId])
    assert.deepEqual(ev.map((e) => e.event), ['created'])
    // the days are held: a second request for the same nights is refused
    const again = await booking.createBooking(napsugar, { ...body, guestEmail: 'masik@example.com' })
    assert.equal(again.ok, false)
  })

  await t('self-contained mail: no sender module; admin gets a ready mailto per booking state; cash on site, never a bank account', async () => {
    const fs = await import('node:fs')
    assert.ok(!fs.existsSync(new URL('../lib/email/send.ts', import.meta.url)), 'no outbound sender')
    const pkg = JSON.parse(fs.readFileSync(new URL('../package.json', import.meta.url), 'utf8'))
    assert.ok(!pkg.dependencies?.nodemailer && !pkg.dependencies?.resend, 'no mail dependency')
    const { mailContext, guestMailFor } = await import('../lib/email/compose')
    // even a legacy deposit key left in the DB must not leak into any letter
    await query("update listings set terms = jsonb_set(coalesce(terms,'{}'::jsonb), '{deposit_pct}', '20') where id = $1", [garden])
    const ctx = (await mailContext('velence', garden))!
    const base = { id: '00000000-0000-4000-8000-0000000000ab', source: 'web' as const, guestName: 'Kiss Anna', guestEmail: 'anna@example.com', guestPhone: null, checkIn: '2027-07-01', checkOut: '2027-07-04', nights: 3, guests: 4, children: 1, pet: false, isEvent: false, total: null, notes: null, createdAt: '' }
    const conf = guestMailFor(ctx, { ...base, status: 'confirmed' })
    assert.equal(conf.label, 'Visszaigazoló e-mail')
    assert.match(conf.href, /^mailto:anna%40example\.com\?subject=/)
    const body = decodeURIComponent(conf.href.split('&body=')[1])
    assert.match(body, /Kedves Kiss Anna/)
    const { CASH_LINE } = await import('../lib/terms')
    assert.ok(body.includes(CASH_LINE), 'the exact cash-on-site sentence')
    assert.ok(!/11773000|Számlaszám|átutal/i.test(body), 'no bank details, no transfer request')
    const pend = decodeURIComponent(guestMailFor(ctx, { ...base, status: 'pending' }).href.split('&body=')[1])
    assert.ok(pend.includes(CASH_LINE))
    assert.ok(!/11773000|Számlaszám/.test(pend))
    await query("update listings set terms = terms - 'deposit_pct' where id = $1", [garden])
    assert.equal(guestMailFor(ctx, { ...base, status: 'cancelled' }).label, 'Lemondó e-mail')
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
