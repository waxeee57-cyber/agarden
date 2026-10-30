import type { DocKind, SiteSettings } from './terms'

// The public menu, derived from real state (pure, testable): GYIK / Környék
// appear only when the owner left them switched on AND wrote something.

export type NavItem = { href: string; label: string; external?: boolean }

export function buildNav(listing: { settings: SiteSettings }, docs: Partial<Record<DocKind, unknown>>, sisterOrigin: string): NavItem[] {
  const items: (NavItem | false)[] = [
    { href: '/foglalas', label: 'Foglalás' },
    { href: '/kepek', label: 'Képek' },
    !!docs.hazirend && { href: '/hazirend', label: 'Házirend' },
    { href: '/aszf', label: 'ÁSZF' },
    { href: '/kapcsolat', label: 'Kapcsolat' },
    listing.settings.menuGyik && !!docs.gyik && { href: '/gyik', label: 'GYIK' },
    listing.settings.menuKornyek && !!docs.kornyek && { href: '/kornyek', label: 'Környék & programok' },
    { href: sisterOrigin, label: 'Testvérházunk', external: true },
  ]
  return items.filter((x): x is NavItem => !!x)
}
