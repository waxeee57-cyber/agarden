import type { Site } from './site-map'

// Static, client-safe brand identity per house. Contact details here are the
// verified facts (owner brief / szallas.hu) used for fallback states that must
// work even when the DB is down (error page, calendar error CTA). The DB copy
// remains the editable source for everything else.

export type Brand = {
  site: Site
  name: string        // short wordmark
  fullName: string
  phone: string
  email: string | null
  colors: { deep: string; deep700: string; accent: string; action: string; paper: string; cream: string; ink: string }
}

export const BRANDS: Record<Site, Brand> = {
  velence: {
    site: 'velence',
    name: 'Garden',
    fullName: 'Garden Vendégház Velence',
    phone: '+36 20 497 1994',
    email: 'gardenvendeghazvelence@gmail.com',
    colors: { deep: '#1E4339', deep700: '#16332B', accent: '#CDA047', action: '#A8552F', paper: '#F2E8D6', cream: '#FBF5EA', ink: '#18241F' },
  },
  napsugar: {
    site: 'napsugar',
    name: 'Napsugár',
    fullName: 'Napsugár Vendégház Velence',
    phone: '+36 30 344 2000',
    email: null,
    colors: { deep: '#22485A', deep700: '#183543', accent: '#E8973A', action: '#A94F1B', paper: '#F7EBD8', cream: '#FDF7EC', ink: '#1B2830' },
  },
}

export const telHref = (phone: string) => `tel:${phone.replace(/[^\d+]/g, '')}`
