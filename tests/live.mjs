// tests/live.mjs — end-to-end checks against the DEPLOYED sites (no login).
//
//   CHROME=<path to chrome.exe> node tests/live.mjs <outDir> [--book]
//
// Per host: desktop + 390 px screenshots, calendar loads real availability,
// sister links point to the other domain, host isolation (404 / 301), admin API
// 401, robots.txt + sitemap.xml + JSON-LD fetched and structurally validated.
// --book: places ONE test booking per house through the real UI (deep-linked
// dates) and prints the booking ids so they can be cleaned up.

import { createRequire } from 'node:module'
import { mkdirSync, writeFileSync } from 'node:fs'
import assert from 'node:assert/strict'

const { chromium } = createRequire(import.meta.url)('playwright')
const [outDir = 'live-out', ...flags] = process.argv.slice(2)
const BOOK = flags.includes('--book')
mkdirSync(outDir, { recursive: true })

const SITES = {
  velence: { origin: 'https://garden-vendeghaz-velence.vercel.app', name: 'Garden Vendégház Velence', other: 'https://napsugar-vendeghaz-velence.vercel.app', otherSlug: 'napsugar' },
  napsugar: { origin: 'https://napsugar-vendeghaz-velence.vercel.app', name: 'Napsugár Vendégház Velence', other: 'https://garden-vendeghaz-velence.vercel.app', otherSlug: 'velence' },
}
const DATES = { velence: ['2027-11-08', '2027-11-10'], napsugar: ['2027-11-15', '2027-11-17'] }

const browser = await chromium.launch({ executablePath: process.env.CHROME || undefined })
const results = []
const ok = (site, check, detail = '') => { results.push({ site, check, ok: true, detail }); console.log(`  ok  [${site}] ${check}${detail ? ' — ' + detail : ''}`) }

try {
  for (const [slug, s] of Object.entries(SITES)) {
    const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } })
    const page = await ctx.newPage()

    const res = await page.goto(s.origin + '/', { waitUntil: 'networkidle' })
    assert.equal(res.status(), 200)
    assert.equal(await page.locator('h1').count(), 1)
    ok(slug, 'home 200, exactly one <h1>', await page.locator('h1').innerText())

    // calendar: availability request succeeds and the loading text disappears
    await page.locator('#foglalas').scrollIntoViewIfNeeded()
    await page.waitForFunction(() => !document.body.innerText.includes('foglaltság betöltése'), null, { timeout: 15000 })
    assert.equal(await page.getByText('A foglaltságot most nem sikerült betölteni').count(), 0)
    const avail = await page.evaluate(async () => (await fetch('/api/availability?from=2026-10-14&to=2027-12-31')).json())
    assert.equal(avail.ok, true)
    ok(slug, 'calendar loaded real availability', `${avail.ranges.length} occupied range(s)`)

    // sister links -> other domain, absolute
    const hrefs = await page.$$eval('a', (as) => as.map((a) => a.href))
    const sister = hrefs.filter((h) => h.startsWith(s.other))
    assert.ok(sister.length >= 3, 'header + section + footer link to sister domain')
    ok(slug, 'sister-house links point to the other domain', `${sister.length} links`)

    // JSON-LD
    const ld = (await page.$$eval('script[type="application/ld+json"]', (xs) => xs.map((x) => x.textContent))).flatMap((t) => JSON.parse(t))
    const types = ld.map((x) => x['@type'])
    for (const t of ['LodgingBusiness', 'WebSite', 'BreadcrumbList', 'FAQPage']) assert.ok(types.includes(t), `JSON-LD ${t}`)
    const lodging = ld.find((x) => x['@type'] === 'LodgingBusiness')
    assert.equal(lodging.url, s.origin + '/')
    assert.ok(lodging.identifier?.value?.startsWith('MA'))
    assert.equal(lodging.aggregateRating, undefined)
    assert.equal(lodging.priceRange, undefined)
    ok(slug, 'JSON-LD valid structure', `${types.join(', ')}; NTAK ${lodging.identifier.value}; maxValue ${lodging.containsPlace.occupancy.maxValue}`)

    // canonical + OG
    const canonical = await page.getAttribute('link[rel=canonical]', 'href')
    assert.equal(canonical, s.origin)
    const og = await page.getAttribute('meta[property="og:image"]', 'content')
    assert.ok(og?.startsWith(s.origin + '/brand/og'))
    const ogRes = await ctx.request.get(og)
    assert.equal(ogRes.headers()['content-type'], 'image/png')
    writeFileSync(`${outDir}/${slug}-og.png`, await ogRes.body())
    ok(slug, 'canonical + OG image on own domain', canonical)

    await page.screenshot({ path: `${outDir}/${slug}-desktop.png`, fullPage: true })
    const mctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true })
    const m = await mctx.newPage()
    await m.goto(s.origin + '/', { waitUntil: 'networkidle' })
    await m.screenshot({ path: `${outDir}/${slug}-mobile-390.png`, fullPage: true })
    const overflow = await m.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)
    assert.ok(overflow <= 0, `no horizontal scroll at 390px (overflow ${overflow})`)
    ok(slug, 'screenshots desktop + 390px, no horizontal overflow')
    await mctx.close()

    // robots + sitemap
    const robots = await (await ctx.request.get(s.origin + '/robots.txt')).text()
    assert.match(robots, new RegExp(`Sitemap: ${s.origin}/sitemap.xml`))
    assert.match(robots, /Disallow: \/admin/)
    assert.match(robots, /Disallow: \/api\//)
    assert.match(robots, /User-Agent: GPTBot/i)
    assert.ok(!robots.includes(s.other))
    writeFileSync(`${outDir}/${slug}-robots.txt`, robots)
    const sitemap = await (await ctx.request.get(s.origin + '/sitemap.xml')).text()
    const locs = [...sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)].map((x) => x[1])
    assert.ok(locs.length >= 4 && locs.every((l) => l.startsWith(s.origin)))
    writeFileSync(`${outDir}/${slug}-sitemap.xml`, sitemap)
    ok(slug, 'robots.txt + sitemap.xml host-specific', `${locs.length} URLs, all on own domain`)

    // isolation
    const foreign = await ctx.request.get(`${s.origin}/${s.otherSlug}`, { maxRedirects: 0 })
    if (slug === 'velence') {
      assert.equal(foreign.status(), 404)
      const legacy = await ctx.request.get(`${s.origin}/velence`, { maxRedirects: 0 })
      assert.equal(legacy.status(), 301)
      assert.equal(new URL(legacy.headers().location, s.origin).pathname, '/')
      ok(slug, 'isolation: /napsugar 404, legacy /velence 301 -> /')
    } else {
      assert.equal(foreign.status(), 404)
      ok(slug, 'isolation: /velence 404 on Napsugár host')
    }
    const me = await ctx.request.get(`${s.origin}/api/admin/me`)
    assert.equal(me.status(), 401)
    const adminPage = await ctx.request.get(`${s.origin}/admin`, { maxRedirects: 0 })
    assert.ok([302, 303, 307, 308].includes(adminPage.status()) || adminPage.url().includes('/admin/login'))
    ok(slug, '/api/admin/me 401 and /admin redirects to login without session', `admin status ${adminPage.status()}`)

    if (BOOK) {
      const [ci, co] = DATES[slug]
      await page.goto(`${s.origin}/?checkIn=${ci}&checkOut=${co}#foglalas`, { waitUntil: 'networkidle' })
      await page.waitForFunction(() => !document.body.innerText.includes('foglaltság betöltése'), null, { timeout: 15000 })
      await page.getByText('A dátumok szabadok').waitFor({ timeout: 15000 })
      await page.fill('#bw-name', 'Playwright Teszt (törölhető)')
      await page.fill('#bw-email', 'playwright-test@example.com')
      await page.fill('#bw-msg', 'Automatikus élő teszt, törölhető.')
      await page.getByRole('button', { name: 'Foglalási kérelem küldése' }).click()
      await page.getByText('Foglalási kérelem rögzítve').waitFor({ timeout: 15000 })
      const id = (await page.locator('dd .tnum').first().innerText()).trim()
      await page.screenshot({ path: `${outDir}/${slug}-booking-success.png` })
      ok(slug, 'UI test booking submitted (deep-linked dates)', `${ci} → ${co}, id prefix ${id}`)
    }
    await ctx.close()
  }
} finally {
  await browser.close()
  writeFileSync(`${outDir}/results.json`, JSON.stringify(results, null, 2))
}
console.log(`live: ${results.length} checks passed`)
