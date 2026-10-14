import { NextRequest } from 'next/server'
import { ImageResponse } from 'next/og'
import { siteFromRequest } from '@/lib/site'
import { BRANDS } from '@/lib/brand'
import { ogFonts } from '@/lib/brand-art'
import { Mark } from '@/components/property/ui'

// 1200×630 Open Graph card per house, in that house's identity. Text is real
// font rendering from vendored TTFs, never generated imagery: accents stay correct.
export async function GET(req: NextRequest) {
  const site = siteFromRequest(req)
  const b = BRANDS[site]
  const { fonts, displayName, sansName } = await ogFonts(site)
  const headers = { 'cache-control': 'public, max-age=3600', vary: 'host' }

  if (site === 'velence') {
    return new ImageResponse(
      (
        <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', padding: '56px 72px', background: '#0D1813', color: '#EFEADF', fontFamily: sansName }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
            <Mark site={site} size={84} />
            <span style={{ fontSize: 26, letterSpacing: 4, textTransform: 'uppercase', color: '#E4A35C' }}>Garden Vendégház · Velence</span>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', fontFamily: displayName, fontSize: 132, lineHeight: 0.86, textTransform: 'uppercase' }}>
            <span>Saját jakuzzi.</span>
            <span>Saját szauna.</span>
            <span style={{ color: '#E4A35C' }}>12 főnek.</span>
          </div>
          <span style={{ fontSize: 28, color: '#A3B3A8' }}>Egyben bérelhető ház · 4 hálószoba · kert bográccsal</span>
        </div>
      ),
      { width: 1200, height: 630, fonts, headers }
    )
  }

  return new ImageResponse(
    (
      <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', padding: '56px 72px', background: '#F2A23C', color: '#1C2930', fontFamily: sansName }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
          <Mark site={site} size={84} />
          <span style={{ fontSize: 26, letterSpacing: 4, textTransform: 'uppercase' }}>{b.fullName}</span>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', fontFamily: displayName, fontSize: 112, lineHeight: 1.0 }}>
          <span>Nyáron medence,</span>
          <span style={{ color: '#0E6070' }}>télen jakuzzi.</span>
        </div>
        <span style={{ fontSize: 30 }}>Egyben bérelhető családi ház 6+2 főre · 200 m² udvar</span>
      </div>
    ),
    { width: 1200, height: 630, fonts, headers }
  )
}
