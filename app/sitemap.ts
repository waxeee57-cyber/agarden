import type { MetadataRoute } from 'next'
import { currentSite, siteOrigin } from '@/lib/site'

// Only THIS host's URLs. The sister house has its own sitemap on its own domain.
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const origin = siteOrigin(await currentSite())
  const now = new Date()
  return [
    { url: `${origin}/`, lastModified: now, changeFrequency: 'weekly', priority: 1 },
    { url: `${origin}/aszf`, lastModified: now, changeFrequency: 'yearly', priority: 0.3 },
    { url: `${origin}/adatvedelem`, lastModified: now, changeFrequency: 'yearly', priority: 0.2 },
    { url: `${origin}/sutik`, lastModified: now, changeFrequency: 'yearly', priority: 0.1 },
  ]
}
