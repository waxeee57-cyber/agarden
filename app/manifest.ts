import type { MetadataRoute } from 'next'
import { currentSite } from '@/lib/site'
import { BRANDS } from '@/lib/brand'

// Web app manifest per host (name, colours, icon of THIS house).
export default async function manifest(): Promise<MetadataRoute.Manifest> {
  const b = BRANDS[await currentSite()]
  return {
    name: b.fullName,
    short_name: b.name,
    lang: 'hu',
    start_url: '/',
    display: 'browser',
    background_color: b.colors.paper,
    theme_color: b.colors.deep,
    icons: [
      { src: '/brand/icon', type: 'image/svg+xml', sizes: 'any' },
      { src: '/brand/apple-icon', type: 'image/png', sizes: '180x180' },
    ],
  }
}
