import { loadSite } from '@/lib/page'
import { BRANDS } from '@/lib/brand'
import { SitePage, PageHead, ContactLinks, pageMeta } from '@/components/property/SiteChrome'
import { ContactForm } from '@/components/property/ContactForm'
import { LocationMap } from '@/components/property/LocationMap'
import { Icon } from '@/components/property/ui'

export const revalidate = 300

export async function generateMetadata({ params }: { params: Promise<{ site: string }> }) {
  const ctx = await loadSite((await params).site)
  const where = ctx.listing.address ?? 'Velence'
  return pageMeta(ctx.site, '/kapcsolat', 'Kapcsolat és megközelítés', `${BRANDS[ctx.site].fullName}: ${where}. Telefon: ${ctx.phone}. Írj üzenetet, vagy nézd meg a térképen.`)
}

export default async function Page({ params }: { params: Promise<{ site: string }> }) {
  const ctx = await loadSite((await params).site)
  const { listing } = ctx
  // Directions by the written address (more precise than our street-level pin).
  const route = listing.address ? `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(listing.address)}` : null
  return (
    <SitePage ctx={ctx} crumb={{ name: 'Kapcsolat', path: '/kapcsolat' }}>
      <PageHead title="Kapcsolat" lead="Hívj, írj, vagy küldj üzenetet: hamar válaszolunk." />
      <div className="mx-auto grid max-w-7xl gap-10 px-4 pb-16 md:px-8 lg:grid-cols-[1fr_1.25fr] lg:gap-16">
        <div className="flex flex-col gap-8">
          <ContactLinks ctx={ctx} />
          {listing.address && (
            <div>
              <h2 className="text-xl">Cím</h2>
              <p className="mt-2 flex gap-3"><Icon name="pin" className="mt-0.5 shrink-0" /> {listing.address}</p>
              {route && (
                <a href={route} target="_blank" rel="noopener noreferrer" className="mt-3 inline-flex min-h-11 items-center gap-2 font-semibold text-pop underline-offset-4 hover:underline">
                  Útvonaltervezés <Icon name="out" size={18} />
                </a>
              )}
            </div>
          )}
          {listing.ntakId && <p className="text-sm text-soft">NTAK regisztrációs szám: {listing.ntakId}</p>}
        </div>
        <div>
          <h2 className="mb-4 text-[clamp(1.6rem,3vw,2.2rem)]">Írj nekünk</h2>
          <ContactForm phone={ctx.phone} />
        </div>
      </div>
      {listing.geo && (
        <section aria-label="Térkép" className="mx-auto max-w-7xl px-4 pb-20 md:px-8">
          <div className="h-[360px] overflow-hidden rounded-[var(--radius-xl)] border border-rule md:h-[440px]">
            <LocationMap lat={listing.geo.lat} lng={listing.geo.lng} label={BRANDS[ctx.site].fullName} color={BRANDS[ctx.site].colors.action} />
          </div>
          <p className="mt-2 text-xs text-soft">A jelölő az utca szintjén pontos; a pontos cím: {listing.address}.</p>
        </section>
      )}
    </SitePage>
  )
}
