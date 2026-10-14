// tests/admin-e2e.mjs — admin flow in a real browser against a LOCAL dev server
// that runs on the throwaway agarden_test DB (never production):
//
//   DATABASE_URL=<agarden_test pooled> SITE_HOST_MAP=velence.localhost:3100=velence,napsugar.localhost:3100=napsugar npx next dev -p 3100
//   CHROME=<chrome.exe> ADMIN_DATABASE_URL=<agarden_test direct> node tests/admin-e2e.mjs <outDir>
//
// A random test admin is created in the TEST DB for this run only; its password
// lives in memory and is never printed.

import { createRequire } from 'node:module'
import { randomBytes } from 'node:crypto'
import { mkdirSync } from 'node:fs'
import assert from 'node:assert/strict'
import { upsertAdmin } from '../scripts/admin-create.mjs'

const { chromium } = createRequire(import.meta.url)('playwright')
const out = process.argv[2] ?? 'admin-e2e-out'
mkdirSync(out, { recursive: true })
const G = 'http://velence.localhost:3100'
const N = 'http://napsugar.localhost:3100'
const email = `e2e-${randomBytes(4).toString('hex')}@test.invalid`
const password = randomBytes(18).toString('base64url')
if (!process.env.ADMIN_DATABASE_URL?.includes('/agarden_test')) throw new Error('refusing: ADMIN_DATABASE_URL must point at agarden_test')
await upsertAdmin(process.env.ADMIN_DATABASE_URL, email, password)

const log = (s) => console.log(`  ok  ${s}`)
const browser = await chromium.launch({ executablePath: process.env.CHROME || undefined })
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true })
const page = await ctx.newPage()

// 1) guest books through the public widget
await page.goto(`${G}/?checkIn=2028-03-06&checkOut=2028-03-09#foglalas`, { waitUntil: 'networkidle' })
await page.getByText('A dátumok szabadok').waitFor({ timeout: 30000 })
await page.fill('#bw-name', 'E2E Vendég')
await page.fill('#bw-email', 'e2e-guest@test.invalid')
await page.getByRole('button', { name: 'Foglalási kérelem küldése' }).click()
await page.getByText('Foglalási kérelem rögzítve').waitFor()
log('guest booking request submitted on Garden')

// 2) admin without session -> login page
await page.goto(`${G}/admin`)
await page.waitForURL(/\/admin\/login/)
await page.fill('#email', email)
await page.fill('#password', password)
await page.getByRole('button', { name: 'Belépés' }).click()
await page.waitForURL(`${G}/admin`)
await page.getByText('E2E Vendég').waitFor()
await page.screenshot({ path: `${out}/admin-inbox-390.png`, fullPage: true })
log('login works; booking visible in Garden admin inbox')

// 3) confirm, then delete
await page.getByText('E2E Vendég').click()
const [resp] = await Promise.all([page.waitForResponse((r) => r.url().includes('/api/admin/bookings/') && r.request().method() === 'PATCH'), page.getByRole('button', { name: 'Visszaigazolás', exact: true }).click()])
  const body = await resp.json(); assert.equal(body.ok, true, 'confirm: ' + JSON.stringify(body))
await page.goto(`${G}/admin?szuro=visszaigazolt`)
await page.getByText('E2E Vendég').waitFor()
log('confirm moves it to "Visszaigazolt"')
page.once('dialog', (d) => d.accept())
await page.getByText('E2E Vendég').click()
await page.getByRole('button', { name: 'Törlés', exact: true }).click()
await page.waitForFunction(() => !document.body.innerText.includes('E2E Vendég'), null, { timeout: 15000 })
const freed = await page.evaluate(async () => (await fetch('/api/availability?from=2028-03-01&to=2028-03-31')).json())
assert.equal(freed.ranges.length, 0)
log('delete from admin frees the dates (availability empty again)')

// 4) block + calendar
await page.goto(`${G}/admin/naptar`)
await page.fill('#b-from', '2028-04-10')
await page.fill('#b-to', '2028-04-12')
await page.getByRole('button', { name: 'Blokk hozzáadása' }).click()
await page.getByText('Blokk rögzítve.').waitFor()
await page.screenshot({ path: `${out}/admin-naptar-390.png`, fullPage: true })
const blocked = await page.evaluate(async () => (await fetch('/api/availability?from=2028-04-01&to=2028-04-30')).json())
assert.equal(blocked.ranges[0]?.kind, 'manual')
log('manual block created and visible to the public availability API')

// 5) pricing -> fixed mode -> public quote shows a total
await page.goto(`${G}/admin/arak`)
await page.fill('#rate', '55000')
await page.getByRole('button', { name: 'Árak mentése' }).click()
await page.getByText('Mentve. A foglalónál').waitFor()
const q = await page.evaluate(async () => (await fetch('/api/quote', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ checkIn: '2028-05-01', checkOut: '2028-05-03', guests: 4 }) })).json())
assert.equal(q.total, 110000)
await page.fill('#rate', '')
await page.getByRole('button', { name: 'Árak mentése' }).click()
await page.getByText('ajánlatkérés módban').waitFor()
log('nightly rate switches to fixed (2 éj × 55 000 = 110 000 Ft), clearing returns to quote')

// 5b) photo upload -> sharp -> Blob -> listed; then delete (removes the blob too)
if (process.env.E2E_PHOTO) {
  await page.goto(`${G}/admin/fotok`)
  const before = await page.locator('li img').count()
  await page.setInputFiles('input[type=file]', process.env.E2E_PHOTO)
  await page.waitForFunction((n) => document.querySelectorAll('li img').length === n + 1, before, { timeout: 60000 })
  const src = await page.locator('li img').last().getAttribute('src')
  page.once('dialog', (d) => d.accept())
  await page.getByRole('button', { name: 'Törlés', exact: true }).last().click()
  await page.waitForFunction((n) => document.querySelectorAll('li img').length === n, before, { timeout: 30000 })
  const key = decodeURIComponent(src ?? '').match(/listings\/velence\/[^&]+\.webp/)?.[0]
  log(`photo upload processed + listed (${key}), then deleted`)
}

// 6) the Garden session does not open the Napsugár admin (cookie is host-bound)
await page.goto(`${N}/admin`)
await page.waitForURL(/napsugar\.localhost:3100\/admin\/login/)
const cross = await page.evaluate(async () => (await fetch('/api/admin/me')).status)
assert.equal(cross, 401)
log('Napsugár admin requires its own login (Garden session not valid there)')

await browser.close()
console.log('admin e2e: all steps passed')
