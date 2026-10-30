import { getPhotos } from '@/lib/listing'
import { loadSite } from '@/lib/page'
import { BRANDS } from '@/lib/brand'
import { SitePage } from '@/components/property/SiteChrome'
import { JsonLd, lodgingJsonLd, websiteJsonLd } from '@/components/property/JsonLd'
import { Home, coverOf } from '@/components/houses/Home'

// ISR: rebuilt at most every 5 minutes; admin edits call revalidatePath.
export const revalidate = 300

export default async function HousePage({ params }: { params: Promise<{ site: string }> }) {
  const ctx = await loadSite((await params).site)
  const [photos, sisterPhotos] = await Promise.all([getPhotos(ctx.listing.id), ctx.sister ? getPhotos(ctx.sister.id) : Promise.resolve([])])
  return (
    <SitePage ctx={ctx} overlayHeader>
      <JsonLd data={[lodgingJsonLd(ctx.listing, ctx.origin, photos), websiteJsonLd(BRANDS[ctx.site].fullName, ctx.origin)]} />
      <Home ctx={ctx} photos={photos} sisterCover={coverOf(sisterPhotos)} />
    </SitePage>
  )
}
