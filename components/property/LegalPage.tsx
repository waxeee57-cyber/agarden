import { notFound } from 'next/navigation'
import { isSite, siteOrigin, sisterOf, type Site } from '@/lib/site-map'
import { getListing, type Listing } from '@/lib/listing'
import { BRANDS } from '@/lib/brand'
import { SiteHeader, SiteFooter } from './SiteChrome'
import { JsonLd, breadcrumbJsonLd } from './JsonLd'

// Shared shell for the legal pages. They are TEMPLATES: operator data the
// owner has not given us yet is shown as a visible "TBD" marker, never guessed.

export function Tbd({ children }: { children: React.ReactNode }) {
  return <span className="tbd">TBD: {children}</span>
}

export async function loadLegal(params: Promise<{ site: string }>): Promise<{ site: Site; listing: Listing }> {
  const { site } = await params
  if (!isSite(site)) notFound()
  const listing = await getListing(site)
  if (!listing) notFound()
  return { site, listing }
}

export function LegalPage({ site, listing, title, path, updated, children }: { site: Site; listing: Listing; title: string; path: string; updated: string; children: React.ReactNode }) {
  const origin = siteOrigin(site)
  return (
    <>
      <JsonLd data={breadcrumbJsonLd(origin, [{ name: BRANDS[site].fullName, path: '/' }, { name: title, path }])} />
      <SiteHeader site={site} sisterOrigin={siteOrigin(sisterOf(site))} />
      <main id="tartalom" className="bg-cream">
        <article className="prose-legal mx-auto max-w-3xl px-4 py-14 md:px-8 md:py-20">
          <p className="label-caps">{BRANDS[site].fullName}</p>
          <h1 className="mt-3 text-4xl md:text-5xl">{title}</h1>
          <p className="mt-3 text-sm text-muted">Hatályos: {updated}. Sablon jellegű dokumentum; a jelölt üzemeltetői adatok pótlásra várnak.</p>
          {children}
        </article>
      </main>
      <SiteFooter listing={listing} sisterOrigin={siteOrigin(sisterOf(site))} />
    </>
  )
}
