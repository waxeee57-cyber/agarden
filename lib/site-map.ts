// Host -> site resolution. Shared by proxy.ts and server code (lib/site.ts).
// No secrets here (SITE_HOST_MAP is public routing config), and no
// 'server-only' import because proxy.ts must be able to load it.
//
// SITE_HOST_MAP format:  host=site,host=site
//   e.g. garden-vendeghaz-velence.vercel.app=velence,napsugar-vendeghaz-velence.vercel.app=napsugar
// The FIRST host listed for a site is its canonical domain. Moving to an own
// domain later = edit this env var only.

import { DEFAULT_SITE, isSite, type Site } from './sites'

export { SITES, DEFAULT_SITE, isSite, sisterOf, type Site } from './sites'

const DEV_MAP = 'velence.localhost:3000=velence,napsugar.localhost:3000=napsugar'

type HostMap = { byHost: Map<string, Site>; primary: Map<Site, string> }

function parse(raw: string): HostMap {
  const byHost = new Map<string, Site>()
  const primary = new Map<Site, string>()
  for (const pair of raw.split(',')) {
    const [host, site] = pair.split('=').map((s) => s?.trim().toLowerCase())
    if (!host || !site || !isSite(site)) continue
    byHost.set(host, site)
    if (!primary.has(site)) primary.set(site, host)
  }
  return { byHost, primary }
}

let cached: { raw: string; map: HostMap } | null = null
function hostMap(): HostMap {
  const raw = process.env.SITE_HOST_MAP || (process.env.NODE_ENV === 'production' ? '' : DEV_MAP)
  if (!cached || cached.raw !== raw) cached = { raw, map: parse(raw) }
  return cached.map
}

/** Site for a request host. `known` is false for unmapped hosts (preview URLs, old alias). */
export function resolveHost(host: string | null | undefined): { site: Site; known: boolean } {
  const h = (host ?? '').toLowerCase()
  const { byHost } = hostMap()
  const hit = byHost.get(h) ?? byHost.get(h.replace(/:\d+$/, ''))
  return hit ? { site: hit, known: true } : { site: DEFAULT_SITE, known: false }
}

/** Absolute origin of a site's canonical domain (https in production). */
export function siteOrigin(site: Site): string {
  const host = hostMap().primary.get(site)
  if (!host) return site === DEFAULT_SITE ? 'http://localhost:3000' : `http://${site}.localhost:3000`
  const local = host.includes('localhost') || host.startsWith('127.')
  return `${local ? 'http' : 'https'}://${host}`
}

/** Request host as the edge saw it. */
export function requestHost(headers: { get(name: string): string | null }): string {
  return headers.get('x-forwarded-host')?.split(',')[0].trim() || headers.get('host') || ''
}
