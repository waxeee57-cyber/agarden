import 'server-only'
import { cache } from 'react'
import { notFound } from 'next/navigation'
import { isSite, siteOrigin, sisterOf, type Site } from './site-map'
import { getListing, getDocuments, type Listing, type ListingDocument } from './listing'
import type { DocKind } from './terms'
import { BRANDS } from './brand'
import { buildNav, type NavItem } from './nav'

export type { NavItem }

// Everything a public page of one house needs, loaded once per request
// (react cache). The menu is derived from real state: GYIK / Környék appear
// only when the owner left them switched on AND wrote something.

export type SiteCtx = {
  site: Site
  listing: Listing
  sister: Listing | null
  docs: Partial<Record<DocKind, ListingDocument>>
  origin: string
  sisterOrigin: string
  phone: string
  nav: NavItem[]
}

export const loadSite = cache(async (siteParam: string): Promise<SiteCtx> => {
  if (!isSite(siteParam)) notFound()
  const site = siteParam
  const [listing, sister] = await Promise.all([getListing(site), getListing(sisterOf(site))])
  if (!listing) notFound()
  const docs = await getDocuments(listing.id)
  const sisterOrigin = siteOrigin(sisterOf(site))
  return {
    site,
    listing,
    sister,
    docs,
    origin: siteOrigin(site),
    sisterOrigin,
    phone: listing.contactPhone ?? BRANDS[site].phone,
    nav: buildNav(listing, docs, sisterOrigin),
  }
})
