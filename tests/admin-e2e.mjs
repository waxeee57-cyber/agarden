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
import pg from 'pg'

// keep in sync with CASH_LINE in lib/terms.ts
const CASH_LINE = 'Előleget nem kérünk: a szállásdíjat érkezéskor, a helyszínen, készpénzben kell kiegyenlíteni.'
const sql = async (text) => { const c = new pg.Client({ connectionString: process.env.ADMIN_DATABASE_URL }); await c.connect(); try { await c.query(text) } finally { await c.end() } }

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
// every confirm() in the admin (delete, restore) is answered "yes"
page.on('dialog', (d) => d.accept())

// 1) guest sends a booking REQUEST through the 2-step wizard (/foglalas)
await page.goto(`${G}/foglalas?checkIn=2028-03-06&checkOut=2028-03-09`, { waitUntil: 'networkidle' })
await page.getByText('Mikor érkeznek?').waitFor({ timeout: 30000 })
await page.getByRole('button', { name: 'Tovább', exact: true }).first().click()
await page.getByRole('button', { name: /^(Elküldöm|Foglalási kérelem elküldése)$/ }).first().click()
await page.getByText('Kérjük, adja meg a nevét.').waitFor()
log('wizard: empty contact step shows the error next to the field')
await page.getByText(CASH_LINE).first().waitFor()
log('booking step states: no deposit, pay on arrival, in cash')
await page.fill('#bw-name', 'E2E Vendég')
await page.fill('#bw-email', 'e2e-guest@test.invalid')
await page.screenshot({ path: `${out}/wizard-contact-390.png`, fullPage: true })
await page.getByRole('button', { name: /^(Elküldöm|Foglalási kérelem elküldése)$/ }).first().click()
await page.getByText('Megkaptuk foglalási kérelmét').waitFor()
await page.getByText('Ez még foglalási kérelem').waitFor()
await page.screenshot({ path: `${out}/wizard-success-390.png`, fullPage: true })
log('guest request submitted on Garden; success screen says it is a request, cash on site')

// an external calendar (Airbnb) reports the same nights -> recorded clash
await sql(`insert into ical_feeds (listing_id, label, url, conflicts)
  select id, 'E2E Airbnb', 'https://e2e.invalid/a.ics', jsonb_build_array(jsonb_build_object('from', '2028-03-07', 'to', '2028-03-08', 'code',
    (select upper(left(b.id::text, 8)) from bookings b where b.guest_email = 'e2e-guest@test.invalid' order by created_at desc limit 1), 'status', 'pending', 'kind', 'booking'))
  from listings where slug = 'velence' on conflict (listing_id, url) do update set conflicts = excluded.conflicts`)

// 2) admin without session -> login page
await page.goto(`${G}/admin`)
await page.waitForURL(/\/admin\/login/)
await page.fill('#email', email)
await page.fill('#password', password)
await page.getByRole('button', { name: 'Belépés' }).click()
await page.waitForURL(`${G}/admin`)
await page.getByText('Mi a teendőd?').waitFor()
await page.getByText('E2E Vendég', { exact: true }).waitFor()
await page.screenshot({ path: `${out}/admin-inbox-390.png`, fullPage: true })
log('login works; booking visible in Garden admin inbox')
await page.getByText(/Ütközés: a\(z\) E2E Airbnb naptár 2028-03-07/).waitFor()
await page.getByText('Ne igazold vissza, amíg nem tisztáztad.').first().waitFor()
log('"Mi a teendőd?" shows the iCal clash with the pending request as urgent')
await page.getByText('E2E Vendég', { exact: true }).click()
assert.ok(await page.getByRole('button', { name: 'Elutasítás', exact: true }).isVisible(), 'pending request can be rejected')
const mail = await page.getByRole('link', { name: /e-mail megírása/ }).first().getAttribute('href')
assert.match(mail, /^mailto:e2e-guest%40test\.invalid\?subject=/)
assert.ok(decodeURIComponent(mail).includes('Kedves E2E Vendég'), 'letter greets the guest by name')
await page.getByText('E2E Vendég', { exact: true }).click()
await sql("delete from ical_feeds where url = 'https://e2e.invalid/a.ics'")
log('pending request: Elutasítás available; prefilled mailto with correct greeting')

// 3) confirm, then delete
await page.getByText('E2E Vendég', { exact: true }).click()
const [resp] = await Promise.all([page.waitForResponse((r) => r.url().includes('/api/admin/bookings/') && r.request().method() === 'PATCH'), page.getByRole('button', { name: 'Visszaigazolás', exact: true }).click()])
  const body = await resp.json(); assert.equal(body.ok, true, 'confirm: ' + JSON.stringify(body))
await page.goto(`${G}/admin?szuro=visszaigazolt`)
await page.getByText('E2E Vendég', { exact: true }).waitFor()
log('confirm moves it to "Visszaigazolt"')
await page.getByText('E2E Vendég', { exact: true }).click()
await page.getByRole('button', { name: 'Törlés', exact: true }).click()
await page.getByText('E2E Vendég', { exact: true }).waitFor({ state: 'detached', timeout: 15000 }) // the activity log may still name the guest
const freed = await page.evaluate(async () => (await fetch('/api/availability?from=2028-03-01&to=2028-03-31')).json())
assert.equal(freed.ranges.length, 0)
log('delete from admin frees the dates (availability empty again)')

// 4) block + calendar
await page.goto(`${G}/admin/naptar`, { waitUntil: "networkidle" })
await page.fill('#b-from', '2028-04-10')
await page.fill('#b-to', '2028-04-12')
await page.getByRole('button', { name: 'Blokk hozzáadása' }).click()
await page.getByText('Blokk rögzítve.').waitFor()
await page.screenshot({ path: `${out}/admin-naptar-390.png`, fullPage: true })
const blocked = await page.evaluate(async () => (await fetch('/api/availability?from=2028-04-01&to=2028-04-30')).json())
assert.equal(blocked.ranges[0]?.kind, 'manual')
log('manual block created and visible to the public availability API')

// 5) pricing -> fixed mode -> public quote shows a total
await page.goto(`${G}/admin/arak`, { waitUntil: "networkidle" })
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
  await page.waitForFunction((n) => document.querySelectorAll('li img').length === n + 1, before, { timeout: 90000 })
  await page.screenshot({ path: `${out}/admin-kepek-390.png`, fullPage: true })
  const src = await page.locator('li img').last().getAttribute('src')
  await page.getByRole('button', { name: 'Törlés', exact: true }).last().click()
  await page.waitForFunction((n) => document.querySelectorAll('li img').length === n, before, { timeout: 30000 })
  const key = decodeURIComponent(src ?? '').match(/listings\/velence\/[^&]+\.webp/)?.[0]
  log(`photo upload processed + listed (${key}), then deleted`)
}

// 5c) house rules: edit -> live -> restore the previous version
await page.goto(`${G}/admin/szovegek?doc=hazirend`)
const ta = page.getByRole('textbox', { name: 'Házirend' })
const original = await ta.inputValue()
await ta.fill(`${original}\n\n## E2E próba\nEz a sor csak a teszt idejére van itt.`)
await page.getByText('Mentetlen változtatások.').waitFor()
await page.getByRole('button', { name: 'Mentés és közzététel' }).click()
await page.getByText('és már élesben is látszik').waitFor()
await page.goto(`${G}/hazirend`)
await page.getByText('Ez a sor csak a teszt idejére van itt.').waitFor()
log('house rules edited in admin and live on /hazirend')
await page.goto(`${G}/admin/szovegek?doc=hazirend`)
await page.getByText('Korábbi változatok').click()
await page.getByRole('button', { name: 'Visszaállítom' }).first().click()
await page.waitForLoadState('networkidle')
assert.equal(await page.getByRole('textbox', { name: 'Házirend' }).inputValue(), original)
await page.goto(`${G}/hazirend`)
assert.equal(await page.getByText('Ez a sor csak a teszt idejére van itt.').count(), 0)
log('previous version restored; the test line is gone from /hazirend')

// 5d) settings: foreign social link rejected by field; GYIK toggle hides the menu item
await page.goto(`${G}/admin/adatok`)
await page.fill('#s-facebook', 'https://www.instagram.com/valami')
await page.getByRole('button', { name: 'Beállítások mentése' }).click()
await page.getByText('Ez nem Facebook-profil link').waitFor()
await page.fill('#s-facebook', 'https://www.facebook.com/gardenvendeghazvelence/')
await page.getByRole('checkbox', { name: /^GYIK/ }).uncheck()
await page.getByRole('button', { name: 'Beállítások mentése' }).click()
await page.getByText('Mentve, a weboldal').waitFor()
await page.goto(`${G}/`)
await page.getByRole('button', { name: /Menü/ }).click()
assert.equal(await page.locator('#site-menu').getByRole('link', { name: 'GYIK' }).count(), 0)
assert.equal((await page.goto(`${G}/gyik`))?.status(), 404)
await page.goto(`${G}/admin/adatok`)
await page.getByRole('checkbox', { name: /^GYIK/ }).check()
await page.getByRole('button', { name: 'Beállítások mentése' }).click()
await page.getByText('Mentve, a weboldal').waitFor()
log('social link validated per network; GYIK toggle hides and restores the menu item + page')

// 6) the Garden session does not open the Napsugár admin (cookie is host-bound)
await page.goto(`${N}/admin`)
await page.waitForURL(/napsugar\.localhost:3100\/admin\/login/)
const cross = await page.evaluate(async () => (await fetch('/api/admin/me')).status)
assert.equal(cross, 401)
log('Napsugár admin requires its own login (Garden session not valid there)')

await browser.close()
console.log('admin e2e: all steps passed')
