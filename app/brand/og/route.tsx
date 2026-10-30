import { NextRequest } from 'next/server'
import { ImageResponse } from 'next/og'
import { siteFromRequest } from '@/lib/site'
import { BRANDS } from '@/lib/brand'
import { ogFonts } from '@/lib/brand-art'
import { Mark } from '@/components/property/ui'

// 1200×630 Open Graph card, same layout for both houses (only the mark and the
// accent differ). Text is real font rendering from vendored TTFs, never
// generated imagery: accents stay correct.
const FACTS = {
  velence: 'Egyben bérelhető ház 10+2 főre · 4 hálószoba · jakuzzi és szauna',
  napsugar: 'Egyben bérelhető családi ház 6+2 főre · medence és jakuzzi · 200 m² udvar',
} as const

export async function GET(req: NextRequest) {
  const site = siteFromRequest(req)
  const b = BRANDS[site]
  const { fonts, displayName, sansName } = await ogFonts()
  return new ImageResponse(
    (
      <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', padding: '64px 72px', background: '#F5F6F2', color: '#1B231F', fontFamily: sansName }}>
        <Mark site={site} size={96} />
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <span style={{ fontFamily: displayName, fontSize: 112, lineHeight: 1.02, letterSpacing: -1 }}>{b.name}</span>
          <span style={{ fontFamily: displayName, fontSize: 56, lineHeight: 1.1, color: b.colors.action }}>Vendégház · Velence</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 24 }}>
          <div style={{ width: 64, height: 6, background: b.colors.action }} />
          <span style={{ fontSize: 30, color: '#56605A' }}>{FACTS[site]}</span>
        </div>
      </div>
    ),
    { width: 1200, height: 630, fonts, headers: { 'cache-control': 'public, max-age=3600', vary: 'host' } }
  )
}
