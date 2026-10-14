import { NextRequest } from 'next/server'
import { siteFromRequest } from '@/lib/site'
import { markSvg } from '@/lib/mark'

// Favicon per host: the house's hand-built SVG mark (lib/mark.ts).
export async function GET(req: NextRequest) {
  return new Response(markSvg(siteFromRequest(req)), {
    headers: { 'content-type': 'image/svg+xml', 'cache-control': 'public, max-age=86400', vary: 'host' },
  })
}
