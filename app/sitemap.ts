import type { MetadataRoute } from 'next'
import { currentSite, siteOrigin } from '@/lib/site'
import { getListing, getDocuments } from '@/lib/listing'

// Only THIS host's URLs. The sister house has its own sitemap on its own domain.
// GYIK / Környék are listed only when they are published (written + switched on).
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const site = await currentSite()
  const origin = siteOrigin(site)
  const listing = await getListing(site)
  const docs = listing ? await getDocuments(listing.id) : {}
  const now = new Date()
  const page = (path: string, priority: number, changeFrequency: 'weekly' | 'monthly' | 'yearly' = 'monthly') => ({ url: `${origin}${path}`, lastModified: now, changeFrequency, priority })
  return [
    page('/', 1, 'weekly'),
    page('/foglalas', 0.9, 'weekly'),
    page('/kepek', 0.7),
    page('/kapcsolat', 0.7),
    ...(docs.hazirend ? [page('/hazirend', 0.5)] : []),
    ...(docs.gyik && listing?.settings.menuGyik ? [page('/gyik', 0.6)] : []),
    ...(docs.kornyek && listing?.settings.menuKornyek ? [page('/kornyek', 0.5)] : []),
    page('/aszf', 0.3, 'yearly'),
    page('/adatvedelem', 0.2, 'yearly'),
    page('/sutik', 0.1, 'yearly'),
  ]
}
