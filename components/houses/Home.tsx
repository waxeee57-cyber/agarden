import Image from 'next/image'
import Link from 'next/link'
import { BRANDS, telHref } from '@/lib/brand'
import type { Photo } from '@/lib/listing'
import type { SiteCtx } from '@/lib/page'
import { Icon, Mark } from '@/components/property/ui'

// The homepage, identical in structure for both houses (owner consultation,
// 2026-10-30): hero with 4 facts and two actions, a ≤3-sentence intro, three
// featured photos, "Miért minket?", the sister house, a contact strip.
// At most 5 photos on the page; everything else lives on its own subpage.

export const coverOf = (photos: Photo[]) => photos.find((p) => p.isCover) ?? photos[0] ?? null

export function featuredOf(photos: Photo[], cover: Photo | null): Photo[] {
  const picked = [1, 2, 3].map((n) => photos.find((p) => p.featured === n)).filter((p): p is Photo => !!p)
  const rest = photos.filter((p) => p.id !== cover?.id && !picked.includes(p))
  return [...picked, ...rest].slice(0, 3)
}

export function Home({ ctx, photos, sisterCover }: { ctx: SiteCtx; photos: Photo[]; sisterCover: Photo | null }) {
  const { listing } = ctx
  const c = listing.content
  const cover = coverOf(photos)
  const featured = featuredOf(photos, cover)
  const chips = c.hero_chips?.length ? c.hero_chips.slice(0, 4) : [`${listing.capacityMax}+${listing.capacityExtra} fő`]
  const why = (c.why ?? []).slice(0, 3)
  const sister = ctx.sister
  const sisterBrand = BRANDS[ctx.site === 'velence' ? 'napsugar' : 'velence']
  const pitch = sister?.content.sister_pitch ?? ''
  const qi = pitch.indexOf('?')

  return (
    <>
      {/* ---------- HERO ---------- */}
      <section aria-labelledby="hero-title" className="relative isolate flex min-h-[86svh] items-end overflow-hidden bg-band text-[#FCFCFA] md:min-h-[88svh]">
        {cover && (
          <Image src={cover.url} alt={cover.alt} fill fetchPriority="high" loading="eager" sizes="100vw" quality={70} className="-z-10 object-cover" />
        )}
        <div aria-hidden="true" className="absolute inset-0 -z-10 bg-[linear-gradient(180deg,rgb(16_22_19/0.35)_0%,rgb(16_22_19/0)_28%,rgb(16_22_19/0.15)_55%,rgb(16_22_19/0.82)_100%)]" />
        <div className="mx-auto w-full max-w-7xl px-4 pb-10 pt-32 md:px-8 md:pb-16">
          <h1 id="hero-title" className="max-w-[16ch] text-[clamp(2.7rem,7.4vw,6rem)] leading-[1.02]">
            {BRANDS[ctx.site].fullName}
          </h1>
          <ul className="mt-6 flex flex-wrap gap-2" aria-label="A ház röviden">
            {chips.map((x) => (
              <li key={x} className="rounded-full border border-[#FCFCFA]/45 bg-[rgb(16_22_19/0.35)] px-4 py-2 text-sm font-semibold backdrop-blur-sm">{x}</li>
            ))}
          </ul>
          <div className="mt-7 flex flex-wrap gap-3">
            <Link href="/foglalas" className="btn btn-act">Foglalás</Link>
            <a href={telHref(ctx.phone)} className="btn btn-light"><Icon name="phone" /> Hívás: {ctx.phone}</a>
          </div>
        </div>
      </section>

      {/* ---------- INTRO (max 3 sentences) ---------- */}
      <section aria-label="Bemutatkozás" className="mx-auto grid max-w-7xl gap-10 px-4 py-16 md:grid-cols-[1.6fr_1fr] md:px-8 md:py-24">
        <p className="font-display text-[clamp(1.6rem,3.2vw,2.5rem)] leading-[1.25]">{c.lead}</p>
        <dl className="grid content-start gap-4 border-t border-rule pt-5 text-sm md:border-l md:border-t-0 md:pl-8 md:pt-1">
          {listing.checkinWindow && <Fact dt="Érkezés" dd={listing.checkinWindow} />}
          {listing.checkoutTime && <Fact dt="Távozás" dd={`${listing.checkoutTime}-ig`} />}
          <Fact dt="Minimum" dd={`${listing.minNights} éjszaka`} />
          {listing.address && <Fact dt="Cím" dd={listing.address} />}
        </dl>
      </section>

      {/* ---------- 3 FEATURED PHOTOS ---------- */}
      {featured.length > 0 && (
        <section aria-labelledby="kepek-title" className="mx-auto max-w-7xl px-4 md:px-8">
          <div className="flex items-end justify-between gap-4">
            <h2 id="kepek-title" className="text-[clamp(1.9rem,4vw,3rem)]">Körülnézés</h2>
            <Link href="/kepek" className="inline-flex min-h-12 items-center gap-2 font-semibold text-pop underline-offset-4 hover:underline">
              Összes kép ({photos.length}) <Icon name="arrow" size={18} />
            </Link>
          </div>
          <div className="mt-6 grid gap-3 md:grid-cols-[1.5fr_1fr] md:grid-rows-2 md:gap-4">
            {featured.map((p, i) => (
              <Link key={p.id} href="/kepek" className={`group relative block overflow-hidden rounded-[var(--radius-lg)] bg-surface-2 ${i === 0 ? 'aspect-[4/3] md:row-span-2 md:aspect-auto' : 'aspect-[16/10]'}`}>
                <Image src={p.url} alt={p.alt} fill sizes={i === 0 ? '(min-width: 768px) 60vw, 100vw' : '(min-width: 768px) 40vw, 100vw'} className="object-cover transition-transform duration-700 ease-out group-hover:scale-[1.03]" />
              </Link>
            ))}
          </div>
        </section>
      )}

      {/* ---------- MIÉRT MINKET? ---------- */}
      {why.length > 0 && (
        <section aria-labelledby="miert-title" className="mx-auto max-w-7xl px-4 py-16 md:px-8 md:py-24">
          <h2 id="miert-title" className="text-[clamp(1.9rem,4vw,3rem)]">Miért minket?</h2>
          <ul className="mt-8 grid gap-x-10 gap-y-8 md:grid-cols-3">
            {why.map((w) => (
              <li key={w.t} className="border-t-2 border-pop pt-5">
                <h3 className="text-[1.45rem] leading-snug">{w.t}</h3>
                <p className="mt-2 text-soft">{w.d}</p>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* ---------- SISTER HOUSE ---------- */}
      {sister && (
        <section aria-labelledby="testver-title" className="mx-auto max-w-7xl px-4 md:px-8">
          <a href={ctx.sisterOrigin} className="group grid overflow-hidden rounded-[var(--radius-xl)] border border-rule bg-surface md:grid-cols-[1fr_1.1fr]">
            <span className="relative block aspect-[16/10] bg-surface-2 md:aspect-auto md:min-h-[320px]">
              {sisterCover ? (
                <Image src={sisterCover.url} alt="" fill sizes="(min-width: 768px) 45vw, 100vw" className="object-cover transition-transform duration-700 ease-out group-hover:scale-[1.03]" />
              ) : (
                <span className="flex h-full items-center justify-center"><Mark site={sisterBrand.site} size={96} /></span>
              )}
            </span>
            <span className="flex flex-col justify-center gap-4 p-6 md:p-10">
              <span className="kicker">Testvérházunk Velencén</span>
              <span id="testver-title" className="font-display text-[clamp(1.7rem,3.4vw,2.6rem)] leading-tight">{qi > 0 ? pitch.slice(0, qi + 1) : sisterBrand.fullName}</span>
              {qi > 0 && <span className="text-soft">{pitch.slice(qi + 1).trim()}</span>}
              <span className="inline-flex items-center gap-2 font-semibold text-pop">
                {sisterBrand.fullName} <Icon name="out" size={18} />
              </span>
            </span>
          </a>
        </section>
      )}

      {/* ---------- CONTACT STRIP ---------- */}
      <section aria-labelledby="kapcsolat-title" className="mx-auto max-w-7xl px-4 py-16 md:px-8 md:py-24">
        <div className="grid gap-8 border-y border-rule py-10 md:grid-cols-[1.2fr_1fr_auto] md:items-center">
          <div>
            <h2 id="kapcsolat-title" className="text-[clamp(1.7rem,3.4vw,2.4rem)]">Kérdésed van? Hívj nyugodtan.</h2>
            {c.contact_hours && <p className="mt-2 text-soft">Telefonon {c.contact_hours} között érsz el.</p>}
          </div>
          <div className="flex flex-col gap-1">
            <a href={telHref(ctx.phone)} className="inline-flex min-h-11 items-center gap-3 text-xl font-semibold underline-offset-4 hover:underline"><Icon name="phone" /> {ctx.phone}</a>
            {listing.contactEmail && <a href={`mailto:${listing.contactEmail}`} className="inline-flex min-h-11 items-center gap-3 break-all underline-offset-4 hover:underline"><Icon name="mail" /> {listing.contactEmail}</a>}
          </div>
          <div className="flex flex-wrap gap-3">
            <Link href="/foglalas" className="btn btn-act">Foglalás</Link>
            <Link href="/kapcsolat" className="btn btn-line">Kapcsolat, térkép</Link>
          </div>
        </div>
      </section>
    </>
  )
}

function Fact({ dt, dd }: { dt: string; dd: string }) {
  return (
    <div>
      <dt className="text-xs font-semibold uppercase tracking-[0.16em] text-soft">{dt}</dt>
      <dd className="mt-1 text-base font-semibold">{dd}</dd>
    </div>
  )
}
