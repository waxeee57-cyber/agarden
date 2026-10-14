import { NextRequest } from 'next/server'
import { ImageResponse } from 'next/og'
import { siteFromRequest } from '@/lib/site'
import { BRANDS } from '@/lib/brand'
import { Mark } from '@/components/property/ui'

export async function GET(req: NextRequest) {
  const site = siteFromRequest(req)
  return new ImageResponse(
    (
      <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', background: BRANDS[site].colors.deep }}>
        <Mark site={site} size={150} />
      </div>
    ),
    { width: 180, height: 180, headers: { 'cache-control': 'public, max-age=86400', vary: 'host' } }
  )
}
