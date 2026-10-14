import { notFound } from 'next/navigation'
import { isSite, siteOrigin, sisterOf } from '@/lib/site-map'
import { getListing, getPhotos } from '@/lib/listing'
import { BRANDS } from '@/lib/brand'
import { MobileStickyCTA } from '@/components/property/MobileStickyCTA'
import { SiteHeader, SiteFooter } from '@/components/property/SiteChrome'
import { JsonLd, lodgingJsonLd, websiteJsonLd, breadcrumbJsonLd, faqJsonLd } from '@/components/property/JsonLd'
import { GardenHome } from '@/components/houses/GardenHome'
import { NapsugarHome } from '@/components/houses/NapsugarHome'
import type { HomeData } from '@/components/houses/shared'
import type { Season } from '@/components/property/SeasonPostcard'

// ISR: rebuilt at most every 5 minutes; admin edits call revalidatePath.
export const revalidate = 300

const NAV: Record<'velence' | 'napsugar', [string, string][]> = {
  velence: [['#hetvege', 'A hétvége'], ['#tudnivalok', 'Tudnivalók'], ['#gyik', 'Kérdések']],
  napsugar: [['#gyerekkel', 'Gyerekkel'], ['#udvar', 'Udvar'], ['#haz', 'A ház'], ['#kepeslapok', 'Képek'], ['#tudnivalok', 'Tudnivalók']],
}

/** May–September in Budapest = summer (pool season); otherwise the jacuzzi leads. */
function currentSeason(): Season {
  const month = Number(new Intl.DateTimeFormat('en', { timeZone: 'Europe/Budapest', month: 'numeric' }).format(new Date()))
  return month >= 5 && month <= 9 ? 'nyar' : 'tel'
}

export default async function HousePage({ params }: { params: Promise<{ site: string }> }) {
  const { site } = await params
  if (!isSite(site)) notFound()
  const sisterSite = sisterOf(site)
  const [listing, sister] = await Promise.all([getListing(site), getListing(sisterSite)])
  if (!listing) notFound()
  const [photos, sisterPhotos] = await Promise.all([getPhotos(listing.id), sister ? getPhotos(sister.id) : Promise.resolve([])])

  const origin = siteOrigin(site)
  const d: HomeData = {
    listing,
    photos,
    sister,
    sisterPhotos,
    origin,
    sisterOrigin: siteOrigin(sisterSite),
    phone: listing.contactPhone ?? BRANDS[site].phone,
    singleNightAllowed: listing.surcharges.some((s) => s.code === 'single_night' && s.active),
  }
  const faq = listing.content.faq ?? []

  return (
    <div data-skin={site === 'velence' ? 'garden' : 'napsugar'} className="skin-root">
      <JsonLd data={[lodgingJsonLd(listing, origin, photos), websiteJsonLd(BRANDS[site].fullName, origin), breadcrumbJsonLd(origin, [{ name: BRANDS[site].fullName, path: '/' }]), ...(faq.length ? [faqJsonLd(faq)] : [])]} />
      <SiteHeader site={site} sisterOrigin={d.sisterOrigin} nav={NAV[site]} overlay />
      <main id="tartalom">
        {site === 'velence' ? <GardenHome d={d} /> : <NapsugarHome d={d} season={currentSeason()} />}
      </main>
      <SiteFooter listing={listing} sisterOrigin={d.sisterOrigin} />
      <MobileStickyCTA phone={d.phone} />
    </div>
  )
}
