import Image from 'next/image'
import Link from 'next/link'
import { BRANDS, telHref } from '@/lib/brand'
import type { Photo } from '@/lib/listing'
import type { SiteCtx } from '@/lib/page'
import { Icon, Mark, type IconName } from '@/components/property/ui'
import { AvailabilityTeaser } from '@/components/property/AvailabilityTeaser'

// The homepage, same structure for both houses. Section order follows the
// reference the owner picked (velenceviolavilla.hu, 2026-10-30): inset hero →
// photo strip → availability → about → key facts → features → why us →
// good to know → sister house. Our own photos, facts and text only.

export const coverOf = (photos: Photo[]) => photos.find((p) => p.isCover) ?? photos[0] ?? null

/** Featured slots 1–3 first, then gallery order; never the cover. */
export function featuredOf(photos: Photo[], cover: Photo | null, n = 3): Photo[] {
  const picked = [1, 2, 3].map((k) => photos.find((p) => p.featured === k)).filter((p): p is Photo => !!p)
  const rest = photos.filter((p) => p.id !== cover?.id && !picked.includes(p))
  return [...picked, ...rest].slice(0, n)
}

const chipIcon = (s: string): IconName =>
  /fő\b/.test(s) ? 'users' : /hálószoba/.test(s) ? 'bed' : /medence/i.test(s) ? 'sun' : /jakuzzi|szauna/i.test(s) ? 'tub' : /udvar|kert/i.test(s) ? 'fire' : /nyitva/.test(s) ? 'calendar' : 'home'

const H2 = 'text-[clamp(1.9rem,4vw,3rem)] leading-[1.1]'

export function Home({ ctx, photos, sisterCover }: { ctx: SiteCtx; photos: Photo[]; sisterCover: Photo | null }) {
  const { listing } = ctx
  const c = listing.content
  const brand = BRANDS[ctx.site]
  const cover = coverOf(photos)
  const strip = featuredOf(photos, cover, 4)
  const facade = photos.find((p) => /homlokzat|a ház és/i.test(p.alt)) ?? strip[0] ?? null
  const chips = (c.hero_chips ?? []).slice(0, 4)
  const features = (c.features ?? []).slice(0, 6)
  const why = (c.why ?? []).slice(0, 3)
  const notes = (c.good_to_know ?? []).slice(0, 3)
  const sister = ctx.sister
  const sisterBrand = BRANDS[ctx.site === 'velence' ? 'napsugar' : 'velence']
  const pitch = sister?.content.sister_pitch ?? ''
  const qi = pitch.indexOf('?')

  return (
    <>
      {/* ---------- 1. HERO (inset photo card) ---------- */}
      <section aria-labelledby="hero-title" className="mx-auto max-w-7xl px-3 pt-3 md:px-6 md:pt-4">
        <div className="relative isolate flex min-h-[78svh] items-end overflow-hidden rounded-[28px] bg-band text-[#FCFCFA] md:min-h-[min(82svh,760px)] md:items-center">
          {cover && <Image src={cover.url} alt={cover.alt} fill fetchPriority="high" loading="eager" sizes="(min-width: 1280px) 1240px, 100vw" quality={70} className="-z-10 object-cover" />}
          <div aria-hidden="true" className="absolute inset-0 -z-10 bg-[linear-gradient(180deg,rgb(16_22_19/0.45)_0%,rgb(16_22_19/0.2)_40%,rgb(16_22_19/0.78)_100%)] md:bg-[radial-gradient(ellipse_at_center,rgb(16_22_19/0.62)_0%,rgb(16_22_19/0.3)_70%)]" />
          <div className="mx-auto w-full max-w-3xl px-5 pb-10 pt-28 md:pb-0 md:pt-0 md:text-center">
            {c.hero_kicker && <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[#FCFCFA]/90 md:text-sm">{c.hero_kicker}</p>}
            <h1 id="hero-title" className="mt-4 text-[clamp(2.7rem,7.4vw,5.6rem)] leading-[1.02]">{brand.fullName}</h1>
            {listing.address && <p className="mt-4 text-lg text-[#FCFCFA]/90">{listing.address}</p>}
            <div className="mt-8 flex flex-wrap gap-3 md:justify-center">
              <Link href="/foglalas" className="btn btn-act">Foglalás</Link>
              <a href={telHref(ctx.phone)} className="btn btn-light"><Icon name="phone" /> {ctx.phone}</a>
            </div>
          </div>
        </div>
      </section>

      {/* ---------- 2. PHOTO STRIP ---------- */}
      {strip.length > 0 && (
        <section aria-label="Fotók a házról" className="mx-auto max-w-7xl px-4 pt-6 md:px-8 md:pt-8">
          <ul className="grid grid-cols-2 gap-3 md:grid-cols-4 md:gap-5">
            {strip.map((p) => (
              <li key={p.id}>
                <Link href="/kepek" className="group relative block aspect-[4/3] overflow-hidden rounded-[var(--radius-lg)] bg-surface-2 md:aspect-[5/6]">
                  <Image src={p.url} alt={p.alt} fill sizes="(min-width: 768px) 25vw, 50vw" className="object-cover transition-transform duration-700 ease-out group-hover:scale-[1.04]" />
                </Link>
              </li>
            ))}
          </ul>
          <p className="mt-4 text-right">
            <Link href="/kepek" className="inline-flex min-h-12 items-center gap-2 font-semibold text-pop underline-offset-4 hover:underline">Mind a {photos.length} fotó <Icon name="arrow" size={18} /></Link>
          </p>
        </section>
      )}

      {/* ---------- 3. AVAILABILITY ---------- */}
      <section aria-labelledby="foglaltsag-title" className="mx-auto grid max-w-7xl gap-8 px-4 py-14 md:px-8 md:py-20 lg:grid-cols-[1fr_1.4fr] lg:gap-16">
        <div>
          <h2 id="foglaltsag-title" className={H2}>Foglaltság</h2>
          <p className="mt-4 max-w-[42ch] text-lg text-soft">Az áthúzott napok foglaltak. Válaszd ki az érkezést és a távozást, és a foglalásnál már ezek a napok lesznek kiválasztva.</p>
          <dl className="mt-6 grid grid-cols-2 gap-4 border-t border-rule pt-5 text-sm">
            {listing.checkinWindow && <Fact dt="Érkezés" dd={listing.checkinWindow} />}
            {listing.checkoutTime && <Fact dt="Távozás" dd={`${listing.checkoutTime}-ig`} />}
            <Fact dt="Minimum" dd={`${listing.minNights} éjszaka`} />
            <Fact dt="Fizetés online" dd="nincs, a kérés ingyenes" />
          </dl>
        </div>
        <AvailabilityTeaser phone={ctx.phone} email={listing.contactEmail} />
      </section>

      {/* ---------- 4. ABOUT ---------- */}
      <section aria-labelledby="haz-title" className="border-t border-rule">
        <div className="mx-auto grid max-w-7xl gap-8 px-4 py-14 md:grid-cols-[1fr_1.3fr] md:px-8 md:py-20 md:gap-16">
          <div className="flex flex-col gap-6">
            {facade && (
              <span className="relative block h-28 w-28 overflow-hidden rounded-full border-4 border-surface shadow-[0_10px_30px_-12px_rgb(27_35_31/0.45)]">
                <Image src={facade.url} alt={facade.alt} fill sizes="112px" className="object-cover" />
              </span>
            )}
            <h2 id="haz-title" className={H2}>A házról</h2>
          </div>
          <div>
            <p className="font-display text-[clamp(1.35rem,2.4vw,1.8rem)] leading-[1.35]">{c.lead}</p>
            {chips.length > 0 && (
              <ul className="mt-6 grid gap-2 text-fg/90 sm:grid-cols-2">
                {[...chips, `Minimum ${listing.minNights} éjszaka`].map((x) => (
                  <li key={x} className="flex items-center gap-3"><Icon name="check" size={18} className="shrink-0 text-pop" /> {x}</li>
                ))}
              </ul>
            )}
            <Link href="/a-haz" className="mt-6 inline-flex min-h-12 items-center gap-2 font-semibold text-pop underline-offset-4 hover:underline">A ház részletesen <Icon name="arrow" size={18} /></Link>
          </div>
        </div>
      </section>

      {/* ---------- 5. KEY FACTS BAND ---------- */}
      {chips.length > 0 && (
        <section aria-label="A ház röviden" className="mx-auto max-w-7xl px-3 md:px-6">
          <div className="rounded-[28px] bg-act px-4 py-10 md:px-10 md:py-14">
            <ul className="mx-auto grid max-w-5xl grid-cols-2 gap-px overflow-hidden rounded-[var(--radius-xl)] bg-rule md:grid-cols-4">
              {chips.map((x) => (
                <li key={x} className="flex flex-col items-center gap-3 bg-surface px-4 py-7 text-center">
                  <Icon name={chipIcon(x)} size={30} className="text-pop" />
                  <span className="text-sm font-semibold uppercase tracking-[0.08em]">{x}</span>
                </li>
              ))}
            </ul>
          </div>
        </section>
      )}

      {/* ---------- 6. FEATURES ---------- */}
      {features.length > 0 && (
        <section aria-labelledby="felszereltseg-title" className="mx-auto max-w-7xl px-4 py-14 md:px-8 md:py-20">
          <h2 id="felszereltseg-title" className={`${H2} mx-auto max-w-[22ch] text-center`}>Ami a házhoz tartozik</h2>
          <ul className="mt-10 grid gap-x-10 gap-y-10 sm:grid-cols-2 lg:grid-cols-3">
            {features.map((f) => (
              <li key={f.t} className="flex flex-col items-center text-center">
                <Icon name={(f.i as IconName) ?? 'home'} size={32} className="text-pop" />
                <h3 className="mt-3 text-[1.35rem]">{f.t}</h3>
                <p className="mt-1.5 max-w-[34ch] text-soft">{f.d}</p>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* ---------- 7. WHY US (split card) ---------- */}
      {why.length > 0 && (
        <section aria-labelledby="miert-title" className="mx-auto max-w-7xl px-4 md:px-8">
          <div className="grid overflow-hidden rounded-[var(--radius-xl)] md:grid-cols-[1fr_1.15fr]">
            <div className="bg-act p-7 text-act-fg md:p-10">
              <h2 id="miert-title" className={H2}>Miért minket?</h2>
              <ul className="mt-6 space-y-5">
                {why.map((w) => (
                  <li key={w.t}>
                    <h3 className="text-[1.3rem]">{w.t}</h3>
                    <p className="mt-1 text-act-fg/85">{w.d}</p>
                  </li>
                ))}
              </ul>
              <Link href="/foglalas" className="btn mt-8 border-act-fg/70 bg-transparent text-act-fg hover:bg-act-fg/10">Foglalás</Link>
            </div>
            {strip[0] && (
              <div className="relative min-h-[260px] bg-surface-2">
                <Image src={strip[0].url} alt="" fill sizes="(min-width: 768px) 55vw, 100vw" className="object-cover" />
              </div>
            )}
          </div>
        </section>
      )}

      {/* ---------- 8. GOOD TO KNOW ---------- */}
      {notes.length > 0 && (
        <section aria-labelledby="tudnivalok-title" className="mx-auto max-w-7xl px-4 py-14 md:px-8 md:py-20">
          <h2 id="tudnivalok-title" className={H2}>Jó tudni</h2>
          <ul className="mt-8 grid gap-6 md:grid-cols-3">
            {notes.map((n) => (
              <li key={n} className="flex gap-3 border-t border-rule pt-5 text-fg/90">
                <Icon name="check" className="mt-0.5 shrink-0 text-pop" /> {n}
              </li>
            ))}
          </ul>
          <p className="mt-8 flex flex-wrap gap-x-6 gap-y-2">
            {ctx.docs.hazirend && <Link href="/hazirend" className="inline-flex min-h-11 items-center font-semibold text-pop underline-offset-4 hover:underline">Teljes házirend</Link>}
            {ctx.listing.settings.menuGyik && ctx.docs.gyik && <Link href="/gyik" className="inline-flex min-h-11 items-center font-semibold text-pop underline-offset-4 hover:underline">Gyakori kérdések</Link>}
          </p>
        </section>
      )}

      {/* ---------- 9. SISTER HOUSE ---------- */}
      {sister && (
        <section aria-labelledby="testver-title" className="mx-auto max-w-7xl px-4 pb-16 md:px-8 md:pb-24">
          <a href={ctx.sisterOrigin} className="group grid overflow-hidden rounded-[var(--radius-xl)] border border-rule bg-surface md:grid-cols-[1fr_1.1fr]">
            <span className="relative block aspect-[16/10] bg-surface-2 md:aspect-auto md:min-h-[300px]">
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
              <span className="inline-flex items-center gap-2 font-semibold text-pop">{sisterBrand.fullName} <Icon name="out" size={18} /></span>
            </span>
          </a>
        </section>
      )}
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
