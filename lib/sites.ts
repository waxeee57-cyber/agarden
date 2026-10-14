// Pure site constants — no env access, safe for client components.
export const SITES = ['velence', 'napsugar'] as const
export type Site = (typeof SITES)[number]
export const DEFAULT_SITE: Site = 'velence'

export function isSite(v: string): v is Site {
  return (SITES as readonly string[]).includes(v)
}

export function sisterOf(site: Site): Site {
  return site === 'velence' ? 'napsugar' : 'velence'
}
