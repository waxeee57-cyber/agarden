import Link from 'next/link'
import { loadSite } from '@/lib/page'
import { getPhotos } from '@/lib/listing'
import type { PhotoCategory } from '@/lib/terms'
import { BRANDS } from '@/lib/brand'
import { SitePage, PageHead, pageMeta } from '@/components/property/SiteChrome'
import { Icon, type IconName } from '@/components/property/ui'
import { formatHuf } from '@/lib/format'
import { SpaceSlider } from '@/components/property/SpaceSlider'

export const revalidate = 86400 // content changes revalidate on save (admin); this is only a safety net

// "A ház" — the reference site's "Szobák" page: every space, the wellness,
// the equipment. Only stored facts (listing.content), one photo per space.

export async function generateMetadata({ params }: { params: Promise<{ site: string }> }) {
  const ctx = await loadSite((await params).site)
  const l = ctx.listing
  const rooms = [l.bedrooms && `${l.bedrooms} hálószoba`, l.bathrooms && `${l.bathrooms} fürdőszoba`].filter(Boolean).join(', ')
  return pageMeta(ctx.site, '/a-haz', 'A ház: szobák, wellness, felszereltség', `${BRANDS[ctx.site].fullName}: egyben bérelhető ház ${l.capacityMax}+${l.capacityExtra} főre${rooms ? `, ${rooms}` : ''}. Szobák, wellness és felszereltség részletesen.`)
}

const SPACE_PHOTO: Record<string, PhotoCategory[]> = { Emelet: ['haloszoba', 'furdo'], Földszint: ['nappali'] }
const lb = (p: { id: string; url: string; width: number; height: number; alt: string }) => ({ id: p.id, url: p.url, width: p.width, height: p.height, alt: p.alt })

export default async function Page({ params }: { params: Promise<{ site: string }> }) {
  const ctx = await loadSite((await params).site)
  const { listing } = ctx
  const c = listing.content
  const photos = await getPhotos(listing.id)
  const of = (cats: PhotoCategory[]) => photos.filter((p) => cats.includes(p.category)).map(lb)
  const wellnessPhotos = of(['wellness'])
  // The reference shows a price line under every unit; ours is the whole house.
  const price = listing.pricingMode === 'fixed' && listing.priceFrom
    ? `${formatHuf(listing.priceFrom)}${listing.priceVaries ? '-tól' : ''} / éj, az egész ház`
    : 'Ár: egyedi ajánlat alapján'
  return (
    <SitePage ctx={ctx} crumb={{ name: 'A ház', path: '/a-haz' }}>
      <PageHead title="A ház" lead={c.lead} />

      <div className="mx-auto max-w-6xl space-y-16 px-5 pb-20 md:px-8">
        {(c.spaces ?? []).map((s, i) => {
          const shots = of(SPACE_PHOTO[s.tag] ?? ['egyeb'])
          return (
            <section key={s.tag} aria-labelledby={`sp-${i}`} className="grid items-center gap-8 md:grid-cols-2 md:gap-14">
              {shots.length > 0 && (
                <div data-reveal className={i % 2 ? 'md:order-2' : ''}>
                  <SpaceSlider items={shots} label={s.title} />
                </div>
              )}
              <div data-reveal style={{ '--i': 1 } as React.CSSProperties}>
                <p className="kicker">{s.tag}</p>
                <h2 id={`sp-${i}`} className="mt-2 text-[clamp(1.8rem,3.6vw,2.6rem)]">{s.title}</h2>
                <ul className="mt-5 space-y-2">
                  {s.items.map((x) => <li key={x} className="flex gap-3"><Icon name="check" size={18} className="mt-1 shrink-0 text-pop" /> {x}</li>)}
                </ul>
                <div className="mt-7 flex flex-wrap items-center gap-x-6 gap-y-3 border-t border-rule pt-5">
                  <p className="font-display text-[1.35rem]">{price}</p>
                  <Link href="/foglalas" className="btn btn-act">Foglalás</Link>
                </div>
              </div>
            </section>
          )
        })}

        {(c.wellness ?? []).length > 0 && (
          <section aria-labelledby="wellness-t" className="grid items-center gap-8 md:grid-cols-2 md:gap-14">
            <div data-reveal>
              <p className="kicker">{c.wellness_eyebrow ?? 'Wellness'}</p>
              <h2 id="wellness-t" className="mt-2 text-[clamp(1.8rem,3.6vw,2.6rem)]">{c.wellness_title}</h2>
              <dl className="mt-6 space-y-5">
                {c.wellness!.map((w) => (
                  <div key={w.t}>
                    <dt className="text-xl font-display">{w.t} <span className="font-sans text-base font-semibold text-pop">{w.k}</span></dt>
                    <dd className="mt-1 text-soft">{w.d}</dd>
                  </div>
                ))}
              </dl>
            </div>
            {wellnessPhotos.length > 0 && (
              <div data-reveal style={{ '--i': 1 } as React.CSSProperties}>
                <SpaceSlider items={wellnessPhotos} label={c.wellness_title ?? 'Wellness'} />
              </div>
            )}
          </section>
        )}

        {(c.features ?? []).length > 0 && (
          <section aria-labelledby="feat-t">
            <h2 id="feat-t" className="text-[clamp(1.8rem,3.6vw,2.6rem)]">{c.amenities_title ?? 'Kert és praktikum'}</h2>
            <ul className="mt-6 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {c.features!.map((f) => (
                <li key={f.t} className="flex gap-4 border-t border-rule pt-5">
                  <Icon name={f.i as IconName} size={26} className="shrink-0 text-pop" />
                  <span><strong className="block">{f.t}</strong><span className="text-soft">{f.d}</span></span>
                </li>
              ))}
            </ul>
          </section>
        )}

        {((c.equipment ?? []).length > 0 || (c.kids ?? []).length > 0) && (
          <section aria-labelledby="eq-t">
            <h2 id="eq-t" className="text-[clamp(1.8rem,3.6vw,2.6rem)]">Felszereltség</h2>
            <ul className="mt-6 flex flex-wrap gap-2">
              {[...(c.equipment ?? []), ...(c.kids ?? [])].map((x) => <li key={x} className="rounded-full border border-rule bg-surface px-4 py-2 text-sm font-semibold">{x}</li>)}
            </ul>
          </section>
        )}

        <div className="flex flex-wrap gap-3 border-t border-rule pt-10">
          <Link href="/foglalas" className="btn btn-act">Foglalás</Link>
          <Link href="/kepek" className="btn btn-line">Mind a {photos.length} fotó</Link>
        </div>
      </div>
    </SitePage>
  )
}
