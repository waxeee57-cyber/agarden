// scripts/test-db.mjs — DB-level test suite against a THROWAWAY database.
//
// Neon branches need a Neon API key (not available through the Vercel
// integration), so tests use a separate database `agarden_test` on the same
// Neon project: dropped + recreated + migrated on every run. Production data
// in `neondb` is never touched.
//
//   pnpm test:db          (reads DATABASE_URL_UNPOOLED from .env.local)
//
// Exports testDatabaseUrl()/resetTestDatabase() for tests/app.test.ts.

import { existsSync, readdirSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import assert from 'node:assert/strict'
import pg from 'pg'
import { migrate } from './migrate.mjs'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
if (existsSync(join(root, '.env.local'))) process.loadEnvFile(join(root, '.env.local'))

const TEST_DB = 'agarden_test'
const VELENCE = '22222222-2222-2222-2222-222222222222'
const NAPSUGAR = '33333333-3333-3333-3333-333333333333'

export function testDatabaseUrl(pooled = false) {
  const base = pooled ? process.env.DATABASE_URL : process.env.DATABASE_URL_UNPOOLED
  if (!base) throw new Error('DATABASE_URL_UNPOOLED missing (.env.local)')
  const u = new URL(base)
  u.pathname = `/${TEST_DB}`
  return u.toString()
}

export async function resetTestDatabase({ quiet = false } = {}) {
  const admin = new pg.Client({ connectionString: process.env.DATABASE_URL_UNPOOLED })
  await admin.connect()
  try {
    await admin.query(`drop database if exists ${TEST_DB} with (force)`)
    await admin.query(`create database ${TEST_DB}`)
  } finally {
    await admin.end()
  }
  await migrate(testDatabaseUrl(), { log: quiet ? () => {} : console.log })
}

// ---------------------------------------------------------------------------

let passed = 0
async function t(name, fn) {
  await fn()
  passed++
  console.log(`  ok  ${name}`)
}

async function run() {
  await resetTestDatabase()
  const db = new pg.Client({ connectionString: testDatabaseUrl() })
  await db.connect()
  const q = async (sql, params) => (await db.query(sql, params)).rows
  const one = async (sql, params) => (await q(sql, params))[0]
  const book = (listing, ci, co, extra = {}) =>
    one(`select book_listing($1,$2,$3,'Teszt Elek','teszt@example.com',2, null,false,false,null,$4) as r`, [
      listing, ci, co, extra.status ?? 'pending',
    ]).then((x) => x.r)

  console.log('db tests (agarden_test):')

  await t('migrations idempotent (second run is a no-op)', async () => {
    await migrate(testDatabaseUrl(), { log: () => {} })
    const n = await one('select count(*)::int as n from applied_migrations')
    const files = readdirSync(join(root, 'db', 'migrations')).filter((f) => /^\d+_.+\.sql$/.test(f))
    assert.equal(n.n, files.length)
  })

  await t('napsugar is active, real data, quote-only, demo-free', async () => {
    const l = await one('select * from listings where slug = $1', ['napsugar'])
    assert.equal(l.status, 'active')
    assert.equal(l.capacity_max, 6)
    assert.equal(l.capacity_extra, 2)
    assert.equal(l.ntak_id, 'MA26128139')
    assert.equal(l.pricing_mode, 'quote')
    assert.equal(l.nightly_rate_huf, null)
    const g = await one('select pricing_mode, nightly_rate_huf from listings where slug = $1', ['velence'])
    assert.deepEqual(g, { pricing_mode: 'quote', nightly_rate_huf: null })
    const active = await one('select count(*)::int as n from listing_surcharges where active')
    assert.equal(active.n, 0)
    const occ = await one('select count(*)::int as n from occupancy')
    assert.equal(occ.n, 0, 'no demo occupancy in production seed')
    const p = await one('select status from listings where slug = $1', ['haz-3'])
    assert.equal(p.status, 'placeholder')
  })

  await t('napsugar quote: valid, quote mode => no total', async () => {
    const { r } = await one('select quote_booking($1, $2, $3) as r', [NAPSUGAR, '2027-05-01', '2027-05-04'])
    assert.equal(r.valid, true)
    assert.equal(r.nights, 3)
    assert.equal(r.pricing_mode, 'quote')
    assert.equal(r.total_huf, null)
  })

  await t('fixed price => total computed by quote_booking', async () => {
    await q('update listings set nightly_rate_huf = 50000, pricing_mode = $2 where id = $1', [NAPSUGAR, 'fixed'])
    await q("update listing_surcharges set amount_huf = 5000, active = true where listing_id = $1 and code = 'pet'", [NAPSUGAR])
    const { r } = await one('select quote_booking($1, $2, $3, true, false) as r', [NAPSUGAR, '2027-05-01', '2027-05-03'])
    assert.equal(r.subtotal_huf, 100000)
    assert.equal(r.total_huf, 105000)
    await q("update listings set nightly_rate_huf = null, pricing_mode = 'quote' where id = $1", [NAPSUGAR])
    await q("update listing_surcharges set amount_huf = 0, active = false where listing_id = $1", [NAPSUGAR])
  })

  await t('min nights: 1 night rejected without active single_night surcharge', async () => {
    const { r } = await one('select quote_booking($1, $2, $3) as r', [NAPSUGAR, '2027-06-01', '2027-06-02'])
    assert.equal(r.valid, false)
    assert.equal(r.reason, 'min_nights')
    const b = await book(NAPSUGAR, '2027-06-01', '2027-06-02')
    assert.equal(b.ok, false)
    assert.equal(b.reason, 'min_nights')
  })

  await t('1 night allowed once single_night surcharge is active', async () => {
    await q("update listing_surcharges set amount_huf = 10000, active = true where listing_id = $1 and code = 'single_night'", [NAPSUGAR])
    const { r } = await one('select quote_booking($1, $2, $3) as r', [NAPSUGAR, '2027-06-01', '2027-06-02'])
    assert.equal(r.valid, true)
    await q("update listing_surcharges set active = false where listing_id = $1 and code = 'single_night'", [NAPSUGAR])
  })

  await t('overlapping booking => overlap; same-day turnover allowed', async () => {
    const a = await book(NAPSUGAR, '2027-07-10', '2027-07-14')
    assert.equal(a.ok, true)
    const clash = await book(NAPSUGAR, '2027-07-12', '2027-07-16')
    assert.deepEqual(clash, { ok: false, reason: 'overlap' })
    const turnover = await book(NAPSUGAR, '2027-07-14', '2027-07-16')
    assert.equal(turnover.ok, true, 'check-out day is next check-in day')
    const other = await book(VELENCE, '2027-07-12', '2027-07-16')
    assert.equal(other.ok, true, 'other listing unaffected')
    const orphan = await one(
      "select count(*)::int as n from bookings b where not exists (select 1 from occupancy o where o.booking_id = b.id) and b.status <> 'quote_request'"
    )
    assert.equal(orphan.n, 0, 'failed overlap left no booking row behind')
  })

  await t('admin block => booking on those dates refused', async () => {
    const { r } = await one("select admin_block($1, $2, $3, 'external', 'teszt') as r", [VELENCE, '2027-08-01', '2027-08-05'])
    assert.equal(r.ok, true)
    const b = await book(VELENCE, '2027-08-03', '2027-08-06')
    assert.deepEqual(b, { ok: false, reason: 'overlap' })
  })

  await t('quote request does not block dates', async () => {
    const { r } = await one(
      "select request_quote($1, 'Ajánlat Anna', 'anna@example.com', '2027-09-01', '2027-09-03') as r",
      [NAPSUGAR]
    )
    assert.equal(r.ok, true)
    const b = await book(NAPSUGAR, '2027-09-01', '2027-09-03')
    assert.equal(b.ok, true)
  })

  await t('cancel releases dates; confirm of other listing booking refused', async () => {
    const a = await book(VELENCE, '2027-10-01', '2027-10-04')
    const cross = await one("select admin_set_booking_status($1, $2, 'cancelled') as r", [a.booking_id, NAPSUGAR])
    assert.deepEqual(cross.r, { ok: false, reason: 'not_found' }, 'listing-scoped')
    const c = await one("select admin_set_booking_status($1, $2, 'cancelled') as r", [a.booking_id, VELENCE])
    assert.equal(c.r.ok, true)
    const again = await book(VELENCE, '2027-10-01', '2027-10-04')
    assert.equal(again.ok, true, 'dates free after cancel')
    const conf = await one("select admin_set_booking_status($1, $2, 'confirmed') as r", [again.booking_id, VELENCE])
    assert.equal(conf.r.ok, true)
  })

  await t('confirming a quote request takes its dates (or reports overlap)', async () => {
    const { r } = await one(
      "select request_quote($1, 'Lead', 'lead@example.com', '2027-10-02', '2027-10-05') as r", [VELENCE]
    )
    const c = await one("select admin_set_booking_status($1, $2, 'confirmed') as r", [r.booking_id, VELENCE])
    assert.deepEqual(c.r, { ok: false, reason: 'overlap' })
  })

  await t('rate_limit_hit allows N then blocks', async () => {
    const res = []
    for (let i = 0; i < 4; i++) res.push((await one("select rate_limit_hit('t:k', 3, 60) as ok")).ok)
    assert.deepEqual(res, [true, true, true, false])
  })

  await t('rate_limits: rows older than 24h are pruned (privacy notice promise)', async () => {
    await q("insert into rate_limits (key, window_start, hits) values ('old:ip', now() - interval '25 hours', 1)")
    for (let i = 0; i < 400; i++) await q("select rate_limit_hit('p:' || $1::text, 1000, 60)", [String(i % 3)])
    const left = await one("select count(*)::int as n from rate_limits where key = 'old:ip'")
    assert.equal(left.n, 0)
  })

  await db.end()
  console.log(`db tests: ${passed} passed`)
}

const isMain = process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]
if (isMain) {
  run().catch((e) => {
    console.error('db tests FAILED:', e)
    process.exit(1)
  })
}
