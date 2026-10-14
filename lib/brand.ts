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
    colors: { deep: '#0D1813', deep700: '#07100C', accent: '#E4A35C', action: '#E4A35C', paper: '#0D1813', cream: '#EFEADF', ink: '#EFEADF' },
  },
  napsugar: {
    site: 'napsugar',
    name: 'Napsugár',
    fullName: 'Napsugár Vendégház Velence',
    phone: '+36 30 344 2000',
    email: null,
    colors: { deep: '#0E6070', deep700: '#0A4B58', accent: '#F2A23C', action: '#0E6070', paper: '#FBF1DF', cream: '#FFF7E8', ink: '#1C2930' },
  },
}

export const telHref = (phone: string) => `tel:${phone.replace(/[^\d+]/g, '')}`
