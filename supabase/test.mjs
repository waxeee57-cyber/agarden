#!/usr/bin/env node
// ============================================================
// Garden Vendeghaz — data-layer acceptance test.   run: pnpm test
//
// Proves, against a FRESH local DB (`supabase db reset`), every claim in the
// slice's Definition of Done. Uses @supabase/supabase-js exactly like the app
// would: an anon client (public booking path) and a service client (admin
// seeding), plus real authenticated sessions for the RLS checks.
//
// Reads connection info from supabase/.env.test (written by scripts/db-test.mjs)
// or from process.env: SUPABASE_URL / SUPABASE_ANON_KEY / SUPABASE_SERVICE_ROLE_KEY.
//
// Exit 0 = all green, 1 = any red.
// ============================================================
import { createClient } from '@supabase/supabase-js'
import { readFileSync, existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const __dir = dirname(fileURLToPath(import.meta.url))

// --- tiny .env.test loader (no dotenv dep) ---
const envFile = join(__dir, '.env.test')
if (existsSync(envFile)) {
  for (const line of readFileSync(envFile, 'utf8').split('\n')) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*"?([^"]*)"?\s*$/)
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2]
  }
}

const URL = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL
const ANON = process.env.SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY
if (!URL || !ANON || !SERVICE) {
  console.error('Missing SUPABASE_URL / SUPABASE_ANON_KEY / SUPABASE_SERVICE_ROLE_KEY')
  console.error('Run `pnpm db:test` (it boots the stack and writes supabase/.env.test).')
  process.exit(1)
}

const admin = createClient(URL, SERVICE, { auth: { persistSession: false } })
const anon = createClient(URL, ANON, { auth: { persistSession: false } })

const VELENCE = '22222222-2222-2222-2222-222222222222'
const HAZ2 = '33333333-3333-3333-3333-333333333333'
const TENANT1 = '11111111-1111-1111-1111-111111111111'

let failures = 0
const ok = (n) => console.log(`  ✓ ${n}`)
const bad = (n, d) => { failures++; console.log(`  ✗ ${n}${d ? ` — ${d}` : ''}`) }
const eq = (n, got, want) => (JSON.stringify(got) === JSON.stringify(want) ? ok(`${n} (=${JSON.stringify(got)})`) : bad(n, `got ${JSON.stringify(got)} want ${JSON.stringify(want)}`))

// ------------------------------------------------------------
async function testSeed() {
  console.log('\n[1] seed loaded (Velence real data + #2/#3 placeholders)')
  const { data: v } = await admin.from('listings').select('status,pricing_mode,nightly_rate_huf,ntak_id,capacity_max').eq('id', VELENCE).single()
  if (v && v.status === 'active' && v.pricing_mode === 'demo' && v.nightly_rate_huf === 75000 && v.ntak_id === 'MA22041986' && v.capacity_max === 10) ok('Velence active, demo price, real NTAK + capacity')
  else bad('Velence seed', JSON.stringify(v))
  const { data: ph } = await admin.from('listings').select('id,capacity_max,ntak_id,nightly_rate_huf,pricing_mode').eq('status', 'placeholder')
  if ((ph?.length ?? 0) === 2 && ph.every((l) => l.capacity_max === null && l.ntak_id === null && l.nightly_rate_huf === null && l.pricing_mode === 'quote'))
    ok('two placeholders, all TBD/null (no invented data)')
  else bad('placeholders', JSON.stringify(ph))
}

// ------------------------------------------------------------
async function testQuote() {
  console.log('\n[2] quote_booking — min-nights + surcharge math')

  // nights == 2 -> valid, single_night NOT applied, total = 2*75000
  {
    const { data } = await anon.rpc('quote_booking', { p_listing_id: VELENCE, p_check_in: '2026-09-01', p_check_out: '2026-09-03', p_pet: false, p_is_event: false })
    const codes = (data?.applied_surcharges ?? []).map((s) => s.code)
    if (data?.valid && data.nights === 2 && !codes.includes('single_night') && data.total_huf === 150000) ok('2 nights valid, no single_night, total=150000')
    else bad('2-night quote', JSON.stringify(data))
  }

  // nights == 1 -> valid, single_night applied, total = 75000 + 15000
  {
    const { data } = await anon.rpc('quote_booking', { p_listing_id: VELENCE, p_check_in: '2026-09-01', p_check_out: '2026-09-02', p_pet: false, p_is_event: false })
    const single = (data?.applied_surcharges ?? []).find((s) => s.code === 'single_night')
    if (data?.valid && data.nights === 1 && single?.amount_huf === 15000 && data.total_huf === 90000) ok('1 night valid, single_night=15000, total=90000')
    else bad('1-night quote', JSON.stringify(data))
  }

  // nights == 1 on a listing with min_nights 2 and NO single_night surcharge -> invalid('min_nights')
  {
    const { data } = await anon.rpc('quote_booking', { p_listing_id: HAZ2, p_check_in: '2026-09-01', p_check_out: '2026-09-02', p_pet: false, p_is_event: false })
    if (data?.valid === false && data.reason === 'min_nights') ok("1 night on #2 (no single_night) -> invalid('min_nights')")
    else bad('min_nights rejection', JSON.stringify(data))
  }

  // pet surcharge added correctly, total = subtotal + pet
  {
    const { data } = await anon.rpc('quote_booking', { p_listing_id: VELENCE, p_check_in: '2026-09-01', p_check_out: '2026-09-03', p_pet: true, p_is_event: false })
    const pet = (data?.applied_surcharges ?? []).find((s) => s.code === 'pet')
    if (data?.valid && pet?.amount_huf === 8000 && data.total_huf === 158000) ok('pet surcharge 8000, total=150000+8000=158000')
    else bad('pet quote', JSON.stringify(data))
  }
}

// ------------------------------------------------------------
async function testBooking() {
  console.log('\n[3] book_listing — overlap impossible, same-day turnover allowed')

  // base booking
  const b1 = await anon.rpc('book_listing', { p_listing_id: VELENCE, p_check_in: '2026-09-01', p_check_out: '2026-09-05', p_guest_name: 'Test One', p_guest_email: 'one@example.com', p_guests_count: 4 })
  if (b1.data?.ok && b1.data.booking_id) ok('base booking 09-01..09-05 created')
  else bad('base booking', JSON.stringify(b1.data ?? b1.error))

  // overlapping booking -> rejected by exclusion constraint (DB-level, not app)
  const b2 = await anon.rpc('book_listing', { p_listing_id: VELENCE, p_check_in: '2026-09-03', p_check_out: '2026-09-07', p_guest_name: 'Test Two', p_guest_email: 'two@example.com', p_guests_count: 2 })
  if (b2.data?.ok === false && b2.data.reason === 'overlap') ok("overlapping 09-03..09-07 -> {ok:false, reason:'overlap'}")
  else bad('overlap rejection', JSON.stringify(b2.data ?? b2.error))

  // same-day turnover: check_in == previous check_out -> allowed (half-open range)
  const b3 = await anon.rpc('book_listing', { p_listing_id: VELENCE, p_check_in: '2026-09-05', p_check_out: '2026-09-08', p_guest_name: 'Test Three', p_guest_email: 'three@example.com', p_guests_count: 3 })
  if (b3.data?.ok && b3.data.booking_id) ok('same-day turnover 09-05..09-08 allowed')
  else bad('same-day turnover', JSON.stringify(b3.data ?? b3.error))

  // confirm exactly one occupancy row exists for the overlap window via service
  const { data: occ } = await admin.from('occupancy').select('id').eq('listing_id', VELENCE).eq('kind', 'booking')
  eq('booking occupancy rows created', occ?.length, 2)
}

// ------------------------------------------------------------
async function testAnonAvailabilityAndPii() {
  console.log('\n[4] anon: availability RPC works, PII tables blocked')

  // availability RPC returns the seeded external blocks (no PII columns)
  const { data: avail, error: aErr } = await anon.rpc('get_listing_availability', { p_listing_id: VELENCE, p_from: '2026-07-01', p_to: '2026-08-31' })
  if (!aErr && (avail?.length ?? 0) >= 2 && avail.every((r) => 'during' in r && 'kind' in r && !('guest_name' in r))) ok(`availability RPC -> ${avail.length} ranges, no PII`)
  else bad('anon availability RPC', JSON.stringify(avail ?? aErr))

  // anon must NOT read bookings (guest PII)
  const { data: bk } = await anon.from('bookings').select('id, guest_email')
  if ((bk?.length ?? 0) === 0) ok('anon bookings read -> blocked / 0 rows')
  else bad('anon read bookings', `leaked ${bk.length} rows`)

  // anon must NOT read occupancy directly
  const { data: oc } = await anon.from('occupancy').select('id, note')
  if ((oc?.length ?? 0) === 0) ok('anon occupancy read -> blocked / 0 rows')
  else bad('anon read occupancy', `leaked ${oc.length} rows`)

  // anon SELECTs active listings + their surcharges (catalog is public)
  const { data: ls } = await anon.from('listings').select('id,status')
  if ((ls?.length ?? 0) === 1 && ls[0].status === 'active') ok('anon listings read -> only active (1)')
  else bad('anon listings read', JSON.stringify(ls))
}

// ------------------------------------------------------------
async function makeAdmin(email, tenantId, role) {
  const { data: created, error } = await admin.auth.admin.createUser({ email, password: 'Passw0rd!test', email_confirm: true })
  if (error) throw new Error(`createUser ${email}: ${error.message}`)
  const uid = created.user.id
  const { error: mErr } = await admin.from('tenant_members').insert({ user_id: uid, tenant_id: tenantId, role })
  if (mErr) throw new Error(`member ${email}: ${mErr.message}`)
  const c = createClient(URL, ANON, { auth: { persistSession: false } })
  const { error: sErr } = await c.auth.signInWithPassword({ email, password: 'Passw0rd!test' })
  if (sErr) throw new Error(`signin ${email}: ${sErr.message}`)
  return { uid, client: c }
}

async function testAdminRls() {
  console.log('\n[5] admin RLS — own tenant full access, cross-tenant denied')

  // second tenant for the cross-tenant check
  const { error: t2Err } = await admin.from('tenants').insert({ id: '99999999-9999-9999-9999-999999999999', name: 'Other Tenant' })
  if (t2Err && !/duplicate/i.test(t2Err.message)) return bad('seed tenant2', t2Err.message)

  let A, B
  try {
    A = await makeAdmin(`admin-a-${Date.now()}@example.com`, TENANT1, 'owner')
    B = await makeAdmin(`admin-b-${Date.now()}@example.com`, '99999999-9999-9999-9999-999999999999', 'owner')
  } catch (e) { return bad('provision admins', e.message) }

  // A sees own tenant bookings (PII) ...
  const { data: aBk } = await A.client.from('bookings').select('id, guest_email')
  if ((aBk?.length ?? 0) >= 2) ok(`admin A reads own-tenant bookings (${aBk.length})`)
  else bad('admin A bookings', JSON.stringify(aBk))

  // ... and own placeholder listing (#2), which anon cannot see
  const { data: aPh } = await A.client.from('listings').select('id').eq('id', HAZ2)
  if ((aPh?.length ?? 0) === 1) ok('admin A reads own placeholder listing #2')
  else bad('admin A placeholder', JSON.stringify(aPh))

  // B (other tenant) sees NONE of tenant1's bookings
  const { data: bBk } = await B.client.from('bookings').select('id')
  if ((bBk?.length ?? 0) === 0) ok('admin B (other tenant) -> 0 cross-tenant bookings')
  else bad('cross-tenant bookings leak', `B saw ${bBk.length}`)

  // B cannot see tenant1's placeholder either (not active, not their tenant)
  const { data: bPh } = await B.client.from('listings').select('id').eq('id', HAZ2)
  if ((bPh?.length ?? 0) === 0) ok('admin B -> 0 cross-tenant placeholder listings')
  else bad('cross-tenant listing leak', JSON.stringify(bPh))

  // admin_block: A allowed on own listing, B forbidden
  const aBlock = await A.client.rpc('admin_block', { p_listing_id: VELENCE, p_from: '2026-12-20', p_to: '2026-12-27', p_kind: 'manual', p_note: 'owner holiday' })
  if (aBlock.data?.ok) ok('admin_block by owner A -> ok')
  else bad('admin_block A', JSON.stringify(aBlock.data ?? aBlock.error))

  const bBlock = await B.client.rpc('admin_block', { p_listing_id: VELENCE, p_from: '2027-01-01', p_to: '2027-01-05', p_kind: 'manual', p_note: 'should fail' })
  if (bBlock.data?.ok === false && bBlock.data.reason === 'forbidden') ok("admin_block by non-member B -> {ok:false, reason:'forbidden'}")
  else bad('admin_block B forbidden', JSON.stringify(bBlock.data ?? bBlock.error))

  // best-effort cleanup of provisioned auth users (no-op-safe if reset follows)
  try { await admin.auth.admin.deleteUser(A.uid); await admin.auth.admin.deleteUser(B.uid) } catch {}
}

async function main() {
  console.log('Garden data-layer test →', URL)
  try {
    await testSeed()
    await testQuote()
    await testBooking()
    await testAnonAvailabilityAndPii()
    await testAdminRls()
  } catch (e) {
    console.error('\ntest crashed:', e)
    failures++
  }
  console.log(`\n${failures === 0 ? '✓ ALL GREEN' : `✗ ${failures} RED`}`)
  process.exit(failures === 0 ? 0 : 1)
}
main()
