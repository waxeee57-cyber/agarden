import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { isSite, siteOrigin, SITES, type Site } from '@/lib/site-map'
import { getListing } from '@/lib/listing'
import { BRANDS } from '@/lib/brand'

// One subtree per house. proxy.ts rewrites each host here, so `site` is always
// the current host's house. dynamicParams=false: any other segment is a 404.
export const dynamicParams = false
export function generateStaticParams() {
  return SITES.map((site) => ({ site }))
}

export async function generateMetadata({ params }: { params: Promise<{ site: string }> }): Promise<Metadata> {
  const { site } = await params
  if (!isSite(site)) return {}
  const listing = await getListing(site)
  const brand = BRANDS[site]
  const seo = listing?.content.seo ?? {}
  const title = seo.title ?? brand.fullName
  const description = seo.description ?? listing?.tagline ?? brand.fullName
  return {
    metadataBase: new URL(siteOrigin(site)),
    title: { default: title, template: `%s | ${brand.fullName}` },
    description,
    applicationName: brand.fullName,
    alternates: { canonical: '/', languages: { 'hu-HU': '/' } },
    openGraph: {
      type: 'website',
      locale: 'hu_HU',
      siteName: brand.fullName,
      url: '/',
      title,
      description,
      images: [{ url: '/brand/og', width: 1200, height: 630, alt: brand.fullName }],
    },
    twitter: { card: 'summary_large_image', title, description, images: ['/brand/og'] },
    icons: {
      icon: [{ url: '/brand/icon', type: 'image/svg+xml' }],
      apple: [{ url: '/brand/apple-icon', sizes: '180x180', type: 'image/png' }],
    },
    manifest: '/manifest.webmanifest',
    robots: { index: true, follow: true },
    formatDetection: { telephone: true },
  }
}

export default async function SiteLayout({ children, params }: { children: React.ReactNode; params: Promise<{ site: string }> }) {
  const { site } = await params
  if (!isSite(site)) notFound()
  return (
    <div data-site={site as Site} className="site-root">
      {children}
    </div>
  )
}
