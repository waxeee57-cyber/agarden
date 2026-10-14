import { NextResponse, type NextRequest } from 'next/server'
import { resolveHost, requestHost } from './lib/site-map'

// Host-based routing: one deployment, two sites.
//   garden-…vercel.app/<path>   -> app/[site=velence]/<path>
//   napsugar-…vercel.app/<path> -> app/[site=napsugar]/<path>
// Each host can only ever reach its OWN subtree: a request for /napsugar/… on
// the Garden host becomes /velence/napsugar/… which does not exist (404), so no
// page is reachable under two domains. Unknown hosts (preview URLs, the old
// agarden-ten alias) serve Garden with `X-Robots-Tag: noindex`.

export function proxy(req: NextRequest) {
  const { site, known } = resolveHost(requestHost(req.headers))
  const { pathname } = req.nextUrl

  // Legacy Garden URL from the single-site era.
  if (site === 'velence' && (pathname === '/velence' || pathname.startsWith('/velence/'))) {
    const to = req.nextUrl.clone()
    to.pathname = '/'
    return NextResponse.redirect(to, 301)
  }

  const url = req.nextUrl.clone()
  url.pathname = `/${site}${pathname === '/' ? '' : pathname}`
  const res = NextResponse.rewrite(url)
  if (!known) res.headers.set('X-Robots-Tag', 'noindex, nofollow')
  return res
}

export const config = {
  // Not rewritten: Next internals, API routes (they resolve the host themselves),
  // host-aware brand assets, and metadata routes / files with an extension.
  matcher: ['/((?!_next/|api/|brand/|.*\\..*).*)'],
}
