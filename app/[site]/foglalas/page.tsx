import { Suspense } from 'react'
import { loadSite } from '@/lib/page'
import { BRANDS } from '@/lib/brand'
import { paymentLine } from '@/lib/terms'
import { SitePage, PageHead, pageMeta } from '@/components/property/SiteChrome'
import { BookingWidget } from '@/components/property/BookingWidget'
import { getPhotos } from '@/lib/listing'
import { coverOf } from '@/components/houses/Home'

export const revalidate = 86400 // content changes revalidate on save (admin); this is only a safety net

export async function generateMetadata({ params }: { params: Promise<{ site: string }> }) {
  const ctx = await loadSite((await params).site)
  const l = ctx.listing
  return pageMeta(ctx.site, '/foglalas', 'Foglalás', `Szabad dátumok és foglalási kérelem: ${BRANDS[ctx.site].fullName}, egyben bérelhető ${l.capacityMax}+${l.capacityExtra} főre. Online nem vonunk le pénzt.`)
}

export default async function Page({ params }: { params: Promise<{ site: string }> }) {
  const ctx = await loadSite((await params).site)
  const l = ctx.listing
  const t = l.terms
  const sisterBrand = BRANDS[ctx.site === 'velence' ? 'napsugar' : 'velence']
  const cover = coverOf(await getPhotos(l.id))
  return (
    <SitePage ctx={ctx} crumb={{ name: 'Foglalás', path: '/foglalas' }} sticky={false}>
      <PageHead
        title="Foglalás"
        lead={`Két rövid lépés. Most nem vonunk le pénzt: ${t.confirmHours ? `${t.confirmHours} órán belül` : 'hamarosan'} e-mailben visszaigazoljuk kérését.`}
      />
      <div className="mx-auto max-w-6xl px-4 pb-20 md:px-8">
        <Suspense fallback={<div className="min-h-[720px] rounded-[var(--radius-xl)] bg-surface-2" aria-hidden="true" />}>
          <BookingWidget
            listing={{
              siteName: l.siteName,
              capacityMax: l.capacityMax,
              capacityExtra: l.capacityExtra,
              minNights: l.minNights,
              pricingMode: l.pricingMode,
              phone: ctx.phone,
              email: l.contactEmail,
              singleNightAllowed: l.surcharges.some((s) => s.code === 'single_night' && s.active),
              confirmHours: t.confirmHours,
              paymentLine: paymentLine(t),
              extraCosts: t.extraCosts,
              cover: cover ? { url: cover.url, alt: cover.alt } : null,
              address: l.address,
            }}
            sister={{ name: sisterBrand.fullName, origin: ctx.sisterOrigin, pitch: ctx.sister?.content.sister_pitch ?? '' }}
          />
        </Suspense>
      </div>
    </SitePage>
  )
}
