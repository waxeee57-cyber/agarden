import { NextRequest } from 'next/server'
import { ImageResponse } from 'next/og'
import { siteFromRequest } from '@/lib/site'
import { BRANDS } from '@/lib/brand'
import { ogFonts } from '@/lib/brand-art'
import { Mark } from '@/components/property/ui'

// 1200×630 Open Graph card per house. Text is real font rendering (Fraunces /
// Hanken Grotesk TTF), never generated imagery, so accents stay correct.
const COPY = {
  velence: { line: 'Egyben bérelhető vendégház 12 főre', facts: '6 fős jakuzzi · 2 fős szauna · kert grillel' },
  napsugar: { line: 'Medencés, jakuzzis családi ház 8 főre', facts: 'Kültéri medence · egész évben jakuzzi · udvar grillel' },
} as const

export async function GET(req: NextRequest) {
  const site = siteFromRequest(req)
  const b = BRANDS[site]
  const copy = COPY[site]
  return new ImageResponse(
    (
      <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', padding: '64px 72px', background: b.colors.deep, color: b.colors.cream, fontFamily: 'Hanken Grotesk' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 22 }}>
          <Mark site={site} size={96} />
          <span style={{ fontSize: 24, letterSpacing: 6, textTransform: 'uppercase', color: b.colors.accent }}>Velencei-tó</span>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <span style={{ fontFamily: 'Fraunces', fontSize: 96, lineHeight: 1.0 }}>{b.fullName}</span>
          <span style={{ marginTop: 22, fontSize: 40 }}>{copy.line}</span>
          <span style={{ marginTop: 14, fontSize: 28, color: b.colors.accent }}>{copy.facts}</span>
        </div>
      </div>
    ),
    { width: 1200, height: 630, fonts: await ogFonts(), headers: { 'cache-control': 'public, max-age=3600', vary: 'host' } }
  )
}
