#!/usr/bin/env node
// ============================================================
// Garden Vendeghaz — SLICE 2 app-layer acceptance test.  run: pnpm test:app
//
// Exercises the four entry points (lib/booking) at the APP boundary — they call
// the slice-1/slice-2 RPCs; no booking logic is duplicated in JS. A service
// client is used ONLY by the test to verify DB side-effects (occupancy rows).
//
// Reads supabase/.env.test (written by scripts/db-test.mjs). Env must be set
// BEFORE importing lib/booking (its anon client reads NEXT_PUBLIC_* at load).
// ============================================================
import { createClient } from '@supabase/supabase-js'
import { readFileSync, existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const __dir = dirname(fileURLToPath(import.meta.url))

const envFile = join(__dir, '.env.test')
if (existsSync(envFile)) {
  for (const line of readFileSync(envFile, 'utf8').split('\n')) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*"?([^"]*)"?\s*$/)
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2]
  }
}
// Map to the names the anon client expects, if only the short names are present.
process.env.NEXT_PUBLIC_SUPABASE_URL ??= process.env.SUPABASE_URL
process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ??= process.env.SUPABASE_ANON_KEY

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY
if (!URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || !SERVICE) {
  console.error('Missing env. Run `pnpm db:test:app` (resets DB + writes supabase/.env.test).')
  process.exit(1)
}

// Import AFTER env is set so the anon singleton picks up the local keys.
const { getAvailability, getQuote, createBooking, requestQuote } = await import('../lib/booking/index.ts')

const svc = createClient(URL, SERVICE, { auth: { persistSession: false } })

const VELENCE = '22222222-2222-2222-2222-222222222222'
const HAZ2 = '33333333-3333-3333-3333-333333333333'

let failures = 0
const ok = (n) => console.log(`  ✓ ${n}`)
const bad = (n, d) => { failures++; console.log(`  ✗ ${n}${d ? ` — ${d}` : ''}`) }

async function occCount(listingId) {
  const { count } = await svc.from('occupancy').select('id', { count: 'exact', head: true }).eq('listing_id', listingId)
  return count ?? 0
}
async function bookingCount(listingId) {
  const { count } = await svc.from('bookings').select('id', { count: 'exact', head: true }).eq('listing_id', listingId)
  return count ?? 0
}

async function testQuotes() {
  console.log('\n[1] getQuote — calls quote_booking RPC (no JS math)')
  // seed nightly_rate_huf = 75000 (DEMO). 2 nights => 150000.
  {
    const q = await getQuote({ listingId: VELENCE, checkIn: '2026-10-01', checkOut: '2026-10-03', guests: 4, pet: false, isEvent: false })
    const codes = q.surcharges.map((s) => s.code)
    if (q.valid && q.nights === 2 && !codes.includes('single_night') && q.total === 150000 && q.pricingMode === 'demo') ok('2 nights valid, no single_night, total=150000')
    else bad('2-night quote', JSON.stringify(q))
  }
  {
    const q = await getQuote({ listingId: VELENCE, checkIn: '2026-10-01', checkOut: '2026-10-02', guests: 2 })
    const single = q.surcharges.find((s) => s.code === 'single_night')
    if (q.valid && q.nights === 1 && single?.amount === 15000 && q.total === 90000) ok('1 night valid, single_night=15000, total=90000')
    else bad('1-night quote', JSON.stringify(q))
  }
  {
    const q = await getQuote({ listingId: VELENCE, checkIn: '2026-10-01', checkOut: '2026-10-03', guests: 2, pet: true })
    const pet = q.surcharges.find((s) => s.code === 'pet')
    if (q.valid && pet?.amount === 8000 && q.total === 158000) ok('pet surcharge 8000, total=158000')
    else bad('pet quote', JSON.stringify(q))
  }
  {
    // placeholder (#2): null rate => quote-only path
    const q = await getQuote({ listingId: HAZ2, checkIn: '2026-10-01', checkOut: '2026-10-05', guests: 2 })
    if (q.valid && q.total === null && q.pricingMode === 'quote') ok('placeholder listing -> valid, total=null, mode=quote')
    else bad('placeholder quote', JSON.stringify(q))
  }
}

async function testCreateBooking() {
  console.log('\n[2] createBooking — capacity check + DB overlap/occupancy')

  // success
  const c1 = await createBooking({ listingId: VELENCE, checkIn: '2026-10-10', checkOut: '2026-10-14', guests: 4, guestName: 'Anna Kovacs', guestEmail: 'anna@example.com' })
  if (c1.ok && c1.bookingId && c1.total === 4 * 75000) ok('booking created 10-10..10-14, total=300000')
  else bad('createBooking success', JSON.stringify(c1))

  // overlap -> from DB exclusion constraint (proves occupancy row exists)
  const c2 = await createBooking({ listingId: VELENCE, checkIn: '2026-10-12', checkOut: '2026-10-16', guests: 2, guestName: 'Bela Nagy', guestEmail: 'bela@example.com' })
  if (!c2.ok && c2.reason === 'overlap') ok("overlapping booking -> {ok:false, reason:'overlap'} (DB, not JS)")
  else bad('overlap rejection', JSON.stringify(c2))

  // guests > capacity (Velence 10 + extra 2 = 12)
  const c3 = await createBooking({ listingId: VELENCE, checkIn: '2026-11-01', checkOut: '2026-11-03', guests: 13, guestName: 'Big Group', guestEmail: 'big@example.com' })
  if (!c3.ok && c3.reason === 'capacity_unavailable') ok("guests 13 > capacity 12 -> 'capacity_unavailable'")
  else bad('capacity over', JSON.stringify(c3))

  // placeholder (capacity null) -> only a quote request is allowed
  const c4 = await createBooking({ listingId: HAZ2, checkIn: '2026-11-01', checkOut: '2026-11-03', guests: 2, guestName: 'PH Guest', guestEmail: 'ph@example.com' })
  if (!c4.ok && c4.reason === 'capacity_unavailable') ok("placeholder booking -> 'capacity_unavailable'")
  else bad('placeholder booking blocked', JSON.stringify(c4))
}

async function testRequestQuote() {
  console.log('\n[3] requestQuote — lead capture, does NOT reserve dates')

  const before = await occCount(HAZ2)
  const r1 = await requestQuote({ listingId: HAZ2, checkIn: '2026-12-01', checkOut: '2026-12-05', guests: 2, guestName: 'Lead One', guestEmail: 'lead1@example.com', message: 'erdeklodom' })
  const after = await occCount(HAZ2)
  if (r1.ok && r1.status === 'quote_request' && after === before) ok('quote_request on #2 -> ok, status quote_request, NO occupancy block')
  else bad('requestQuote', `${JSON.stringify(r1)} occ ${before}->${after}`)

  // verify the row really is a quote_request with null total
  const { data: row } = await svc.from('bookings').select('status,total_huf').eq('id', r1.bookingId).single()
  if (row?.status === 'quote_request' && row.total_huf === null) ok('stored row: status quote_request, total NULL')
  else bad('quote_request row', JSON.stringify(row))

  // soft dates: a dateless quote request is accepted
  const r2 = await requestQuote({ listingId: HAZ2, guests: 3, guestName: 'Lead Two', guestEmail: 'lead2@example.com' })
  if (r2.ok && r2.status === 'quote_request') ok('dateless quote_request accepted (soft dates)')
  else bad('dateless requestQuote', JSON.stringify(r2))
}

async function testAvailabilityAndValidation() {
  console.log('\n[4] getAvailability + zod validation (RPC not called on bad input)')

  const a = await getAvailability({ listingId: VELENCE, from: '2026-10-01', to: '2026-10-31' })
  if (a.ok && a.ranges.length >= 1 && a.ranges.every((r) => 'during' in r && 'kind' in r && !('guest_name' in r))) ok(`availability -> ${a.ranges.length} range(s), no PII`)
  else bad('getAvailability', JSON.stringify(a))

  // bad email -> validation_error, and NO booking row is created
  const before = await bookingCount(VELENCE)
  const v1 = await createBooking({ listingId: VELENCE, checkIn: '2026-10-20', checkOut: '2026-10-22', guests: 2, guestName: 'X', guestEmail: 'not-an-email' })
  const after = await bookingCount(VELENCE)
  if (!v1.ok && v1.reason === 'validation_error' && after === before) ok("bad email -> 'validation_error', RPC not called (no row)")
  else bad('zod email', `${JSON.stringify(v1)} count ${before}->${after}`)

  // checkOut <= checkIn -> validation_error from getQuote (refine), RPC not called
  const v2 = await getQuote({ listingId: VELENCE, checkIn: '2026-10-05', checkOut: '2026-10-05', guests: 2 })
  if (!v2.valid && v2.reason === 'validation_error') ok("checkOut<=checkIn -> 'validation_error'")
  else bad('zod dates', JSON.stringify(v2))

  // invalid uuid -> validation_error
  const v3 = await getAvailability({ listingId: 'nope', from: '2026-10-01', to: '2026-10-31' })
  if (!v3.ok && v3.reason === 'validation_error') ok("invalid uuid -> 'validation_error'")
  else bad('zod uuid', JSON.stringify(v3))
}

async function main() {
  console.log('Garden app-layer test →', URL)
  try {
    await testQuotes()
    await testCreateBooking()
    await testRequestQuote()
    await testAvailabilityAndValidation()
  } catch (e) {
    console.error('\ntest crashed:', e)
    failures++
  }
  console.log(`\n${failures === 0 ? '✓ ALL GREEN' : `✗ ${failures} RED`}`)
  // Set exitCode (don't call process.exit) so tsx/esbuild tears down cleanly on
  // Windows; force-exit shortly after in case a client keep-alive lingers.
  process.exitCode = failures === 0 ? 0 : 1
  setTimeout(() => process.exit(process.exitCode), 200).unref()
}
main()
