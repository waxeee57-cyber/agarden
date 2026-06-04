#!/usr/bin/env node
// One-off: apply supabase/seed.sql to a HOSTED Postgres (connection URI in
// $SUPABASE_DB_URL) and verify the data is really there with SELECT counts.
// Idempotent — seed.sql uses ON CONFLICT DO NOTHING. Run AFTER `db push`.
import pg from 'pg'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const conn = process.env.SUPABASE_DB_URL
if (!conn) { console.error('Missing SUPABASE_DB_URL'); process.exit(1) }

const seed = readFileSync(join(root, 'supabase', 'seed.sql'), 'utf8')
const client = new pg.Client({ connectionString: conn, ssl: { rejectUnauthorized: false } })

const q = async (sql) => (await client.query(sql)).rows

try {
  await client.connect()
  console.log('connected → seeding…')
  await client.query(seed)
  console.log('seed applied.\n')

  const listings = await q(`select status, count(*)::int as n from listings group by status order by status`)
  const total = await q(`select count(*)::int as n from listings`)
  const occ = await q(`select kind, count(*)::int as n from occupancy group by kind order by kind`)
  const velence = await q(`select slug, status, pricing_mode, nightly_rate_huf, ntak_id from listings where slug='velence'`)

  console.log('listings by status:', listings)
  console.log('listings total:', total[0].n)
  console.log('occupancy by kind:', occ)
  console.log('velence row:', velence[0])

  const okListings = total[0].n === 3
  const okActive = listings.some((r) => r.status === 'active' && r.n === 1)
  const okPh = listings.some((r) => r.status === 'placeholder' && r.n === 2)
  const okOcc = occ.some((r) => r.kind === 'external' && r.n === 2)
  const allOk = okListings && okActive && okPh && okOcc
  console.log(`\n${allOk ? '✓ SEED VERIFIED' : '✗ SEED INCOMPLETE'} (listings=3? ${okListings}, active=1? ${okActive}, placeholders=2? ${okPh}, external occ=2? ${okOcc})`)
  process.exitCode = allOk ? 0 : 1
} catch (e) {
  console.error('remote-seed failed:', e.message)
  process.exitCode = 1
} finally {
  await client.end().catch(() => {})
}
