// Social links (pure, client-safe). Only filled, valid links are ever shown.
// Each network accepts only its own domains, so a typo or a pasted foreign URL
// is rejected in the admin instead of rendering a broken icon on the site.

export const SOCIAL_NETWORKS = ['facebook', 'instagram', 'tiktok'] as const
export type SocialNetwork = (typeof SOCIAL_NETWORKS)[number]
export type SocialLinks = Partial<Record<SocialNetwork, string>>

export const SOCIAL_LABEL: Record<SocialNetwork, string> = { facebook: 'Facebook', instagram: 'Instagram', tiktok: 'TikTok' }

const HOSTS: Record<SocialNetwork, string[]> = {
  facebook: ['facebook.com', 'fb.com', 'm.facebook.com'],
  instagram: ['instagram.com'],
  tiktok: ['tiktok.com'],
}

/** Normalized https URL, or null if it is not a profile link of that network. */
export function normalizeSocial(network: SocialNetwork, raw: string): string | null {
  const v = raw.trim()
  if (!v) return null
  let u: URL
  try {
    u = new URL(/^https?:\/\//i.test(v) ? v : `https://${v}`)
  } catch {
    return null
  }
  if (u.protocol !== 'https:' && u.protocol !== 'http:') return null
  const host = u.hostname.toLowerCase().replace(/^www\./, '')
  if (!HOSTS[network].includes(host)) return null
  if (u.pathname.replace(/\/+$/, '').length < 2) return null // bare domain is not a profile
  u.protocol = 'https:'
  u.hash = ''
  return u.toString()
}

/** DB jsonb -> only valid links, in network order. */
export function socialFromDb(raw: unknown): SocialLinks {
  const r = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>
  const out: SocialLinks = {}
  for (const n of SOCIAL_NETWORKS) {
    const v = typeof r[n] === 'string' ? normalizeSocial(n, r[n] as string) : null
    if (v) out[n] = v
  }
  return out
}

export const socialEntries = (s: SocialLinks) => SOCIAL_NETWORKS.filter((n) => s[n]).map((n) => [n, s[n]!] as const)
