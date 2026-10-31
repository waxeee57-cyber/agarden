import Image from 'next/image'
import Link from 'next/link'
import { loadSite } from '@/lib/page'
import { getPhotos } from '@/lib/listing'
import type { PhotoCategory } from '@/lib/terms'
import { BRANDS } from '@/lib/brand'
import { SitePage, PageHead, pageMeta } from '@/components/property/SiteChrome'
import { Icon, type IconName } from '@/components/property/ui'

export const revalidate = 300

// "A ház" — the reference site's "Szobák" page: every space, the wellness,
// the equipment. Only stored facts (listing.content), one photo per space.

export async function generateMetadata({ params }: { params: Promise<{ site: string }> }) {
  const ctx = await loadSite((await params).site)
  const l = ctx.listing
  const rooms = [l.bedrooms && `${l.bedrooms} hálószoba`, l.bathrooms && `${l.bathrooms} fürdőszoba`].filter(Boolean).join(', ')
  return pageMeta(ctx.site, '/a-haz', 'A ház: szobák, wellness, felszereltség', `${BRANDS[ctx.site].fullName}: egyben bérelhető ház ${l.capacityMax}+${l.capacityExtra} főre${rooms ? `, ${rooms}` : ''}. Szobák, wellness és felszereltség részletesen.`)
}

const SPACE_PHOTO: Record<string, PhotoCategory> = { Emelet: 'haloszoba', Földszint: 'nappali' }

export default async function Page({ params }: { params: Promise<{ site: string }> }) {
  const ctx = await loadSite((await params).site)
  const { listing } = ctx
  const c = listing.content
  const photos = await getPhotos(listing.id)
  const firstOf = (cat: PhotoCategory) => photos.find((p) => p.category === cat) ?? null
  const wellnessPhoto = firstOf('wellness')
  return (
    <SitePage ctx={ctx} crumb={{ name: 'A ház', path: '/a-haz' }}>
      <PageHead title="A ház" lead={c.lead} />

      <div className="mx-auto max-w-6xl space-y-16 px-5 pb-20 md:px-8">
        {(c.spaces ?? []).map((s, i) => {
          const photo = firstOf(SPACE_PHOTO[s.tag] ?? 'egyeb')
          return (
            <section key={s.tag} aria-labelledby={`sp-${i}`} className="grid items-center gap-8 md:grid-cols-2 md:gap-14">
              {photo && (
                <div className={`relative aspect-[4/3] overflow-hidden rounded-[var(--radius-xl)] bg-surface-2 ${i % 2 ? 'md:order-2' : ''}`}>
                  <Image src={photo.url} alt={photo.alt} fill sizes="(min-width: 768px) 50vw, 100vw" className="object-cover" />
                </div>
              )}
              <div>
                <p className="kicker">{s.tag}</p>
                <h2 id={`sp-${i}`} className="mt-2 text-[clamp(1.8rem,3.6vw,2.6rem)]">{s.title}</h2>
                <ul className="mt-5 space-y-2">
                  {s.items.map((x) => <li key={x} className="flex gap-3"><Icon name="check" size={18} className="mt-1 shrink-0 text-pop" /> {x}</li>)}
                </ul>
              </div>
            </section>
          )
        })}

        {(c.wellness ?? []).length > 0 && (
          <section aria-labelledby="wellness-t" className="grid items-center gap-8 md:grid-cols-2 md:gap-14">
            <div>
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
            {wellnessPhoto && (
              <div className="relative aspect-[4/3] overflow-hidden rounded-[var(--radius-xl)] bg-surface-2">
                <Image src={wellnessPhoto.url} alt={wellnessPhoto.alt} fill sizes="(min-width: 768px) 50vw, 100vw" className="object-cover" />
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
