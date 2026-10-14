import type { MetadataRoute } from 'next'
import { headers } from 'next/headers'
import { resolveHost, requestHost, siteOrigin } from '@/lib/site'

// Host-aware robots.txt: each house points to ITS OWN sitemap. Unmapped hosts
// (preview deployments, the legacy alias) are fully disallowed. AI crawlers
// are explicitly allowed (same rules as everyone else).
export default async function robots(): Promise<MetadataRoute.Robots> {
  const { site, known } = resolveHost(requestHost(await headers()))
  if (!known) return { rules: [{ userAgent: '*', disallow: '/' }] }
  const origin = siteOrigin(site)
  const disallow = ['/admin', '/api/']
  return {
    rules: [
      { userAgent: '*', allow: '/', disallow },
      {
        userAgent: ['GPTBot', 'OAI-SearchBot', 'ChatGPT-User', 'ClaudeBot', 'Claude-User', 'Claude-SearchBot', 'PerplexityBot', 'Google-Extended', 'Applebot-Extended', 'CCBot'],
        allow: '/',
        disallow,
      },
    ],
    sitemap: `${origin}/sitemap.xml`,
    host: origin,
  }
}
