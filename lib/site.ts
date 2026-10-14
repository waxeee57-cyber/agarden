import 'server-only'
import { headers } from 'next/headers'
import { resolveHost, requestHost, type Site } from './site-map'

export * from './site-map'

/** Site of the current request (Server Components / route handlers). */
export async function currentSite(): Promise<Site> {
  return resolveHost(requestHost(await headers())).site
}

/** Site for a route-handler request — the listing ALWAYS comes from the host, never the body. */
export function siteFromRequest(req: { headers: { get(name: string): string | null } }): Site {
  return resolveHost(requestHost(req.headers)).site
}
