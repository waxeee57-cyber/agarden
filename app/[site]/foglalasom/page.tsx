import { Suspense } from 'react'
import { loadSite } from '@/lib/page'
import { BRANDS } from '@/lib/brand'
import { SitePage, PageHead, pageMeta } from '@/components/property/SiteChrome'
import { BookingLookup } from '@/components/property/BookingLookup'

export const revalidate = 300

export async function generateMetadata({ params }: { params: Promise<{ site: string }> }) {
  const ctx = await loadSite((await params).site)
  return { ...pageMeta(ctx.site, '/foglalasom', 'Foglalásom', `${BRANDS[ctx.site].fullName}: foglalása állapota a foglalási kód és az e-mail-cím megadásával.`), robots: { index: false, follow: true } }
}

// "Foglalásom" (the reference engine's "My booking" tab): status by code + e-mail.
export default async function Page({ params }: { params: Promise<{ site: string }> }) {
  const ctx = await loadSite((await params).site)
  return (
    <SitePage ctx={ctx} crumb={{ name: 'Foglalásom', path: '/foglalasom' }}>
      <PageHead title="Foglalásom" lead="A foglalási kódot a visszaigazoló e-mailben és a foglalás végén találja (8 karakter)." />
      <div className="mx-auto max-w-6xl px-5 pb-20 md:px-8">
        <Suspense fallback={<div className="min-h-[320px]" aria-hidden="true" />}>
          <BookingLookup phone={ctx.phone} />
        </Suspense>
      </div>
    </SitePage>
  )
}
