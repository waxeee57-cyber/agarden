import { Suspense } from 'react'
import { loadSite } from '@/lib/page'
import { BRANDS } from '@/lib/brand'
import { depositLine } from '@/lib/terms'
import { SitePage, PageHead, pageMeta } from '@/components/property/SiteChrome'
import { BookingWidget } from '@/components/property/BookingWidget'

export const revalidate = 300

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
  return (
    <SitePage ctx={ctx} crumb={{ name: 'Foglalás', path: '/foglalas' }} sticky={false}>
      <PageHead
        title="Foglalás"
        lead={`Négy rövid lépés. Most nem vonunk le pénzt: ${t.confirmHours ? `${t.confirmHours} órán belül` : 'hamarosan'} e-mailben visszaigazoljuk a kérésed.`}
      />
      <div className="mx-auto max-w-4xl px-4 pb-20 md:px-8">
        <Suspense fallback={<div className="panel min-h-[640px]" aria-hidden="true" />}>
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
              depositLine: depositLine(t),
              extraCosts: t.extraCosts,
            }}
            sister={{ name: sisterBrand.fullName, origin: ctx.sisterOrigin, pitch: ctx.sister?.content.sister_pitch ?? '' }}
          />
        </Suspense>
      </div>
    </SitePage>
  )
}
