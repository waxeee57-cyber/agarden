import Image from 'next/image'
import Link from 'next/link'
import { BRANDS, telHref } from '@/lib/brand'
import type { Photo } from '@/lib/listing'
import type { SiteCtx } from '@/lib/page'
import { Icon, Mark, type IconName } from '@/components/property/ui'
import { AvailabilityTeaser } from '@/components/property/AvailabilityTeaser'

// The homepage, same structure for both houses. Section order follows the
// reference the owner picked (velenceviolavilla.hu): inset hero → photo strip
// → availability → about → key facts on a photo → features → why us →
// good to know → sister house. Our own photos, facts and text only.
// Visual rule: one quiet didone (Gilda) for headings, thin line icons in ink,
// colour only on actions and on one muted block — restraint over decoration.

export const coverOf = (photos: Photo[]) => photos.find((p) => p.isCover) ?? photos[0] ?? null

/** Featured slots 1–3 first, then gallery order; never the cover. */
export function featuredOf(photos: Photo[], cover: Photo | null, n = 3): Photo[] {
  const picked = [1, 2, 3].map((k) => photos.find((p) => p.featured === k)).filter((p): p is Photo => !!p)
  const rest = photos.filter((p) => p.id !== cover?.id && !picked.includes(p))
  return [...picked, ...rest].slice(0, n)
}

const chipIcon = (s: string): IconName =>
  /\d\s*fő/.test(s) ? 'users' : /hálószoba/.test(s) ? 'bed' : /medence/i.test(s) ? 'sun' : /jakuzzi|szauna/i.test(s) ? 'tub' : /udvar|kert/i.test(s) ? 'fire' : /nyitva/.test(s) ? 'calendar' : 'home'

const H2 = 'text-[clamp(2rem,3.6vw,3rem)]'
const SECTION = 'mx-auto max-w-6xl px-5 md:px-8'

export function Home({ ctx, photos, sisterCover }: { ctx: SiteCtx; photos: Photo[]; sisterCover: Photo | null }) {
  const { listing } = ctx
  const c = listing.content
  const brand = BRANDS[ctx.site]
  const cover = coverOf(photos)
  const strip = featuredOf(photos, cover, 4)
  const facade = photos.find((p) => /homlokzat|a ház és/i.test(p.alt)) ?? strip[0] ?? null
  // the key-facts band sits on a garden/yard photo not used above
  const bandPhoto = photos.find((p) => p.category === 'kert' && p.id !== facade?.id && !strip.includes(p) && p.id !== cover?.id) ?? null
  const splitPhoto = photos.find((p) => p.category === 'nappali' && !strip.includes(p)) ?? strip[0] ?? null
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
      {/* ---------- 1. HERO ---------- */}
      <section aria-labelledby="hero-title" className="mx-auto max-w-[1400px] px-3 pt-3 md:px-10 md:pt-8">
        <div className="relative isolate flex min-h-[74svh] items-end overflow-hidden rounded-[14px] bg-band text-[#FEFEFC] md:min-h-[min(76svh,640px)] md:items-center">
          {cover && <Image src={cover.url} alt={cover.alt} fill fetchPriority="high" loading="eager" sizes="(min-width: 1400px) 1320px, 100vw" quality={70} className="-z-10 object-cover" />}
          <div aria-hidden="true" className="absolute inset-0 -z-10 bg-[rgb(18_22_20/0.42)]" />
          <div aria-hidden="true" className="absolute inset-x-0 bottom-0 -z-10 h-1/2 bg-gradient-to-t from-[rgb(18_22_20/0.55)] to-transparent md:hidden" />
          <div className="mx-auto w-full max-w-6xl px-6 pb-12 pt-32 md:py-16 md:text-center">
            {c.hero_kicker && <p className="text-[0.72rem] font-semibold uppercase tracking-[0.32em] text-[#FEFEFC]/90">{c.hero_kicker}</p>}
            <h1 id="hero-title" className="mt-5 text-[clamp(2.6rem,5.6vw,4.6rem)] leading-[1.05]">{brand.fullName}</h1>
            {listing.address && <p className="mt-4 text-[1.05rem] font-light text-[#FEFEFC]/90">{listing.address}</p>}
            <div className="mt-9 flex flex-wrap gap-3 md:justify-center">
              <Link href="/foglalas" className="btn btn-white">Foglalás</Link>
              <a href={telHref(ctx.phone)} className="btn btn-light"><Icon name="phone" size={16} /> {ctx.phone}</a>
            </div>
          </div>
        </div>
      </section>

      {/* ---------- 2. PHOTO STRIP ---------- */}
      {strip.length > 0 && (
        <section aria-label="Fotók a házról" className={`${SECTION} pt-8 md:pt-10`}>
          <ul className="grid grid-cols-2 gap-3 md:grid-cols-4 md:gap-6">
            {strip.map((p) => (
              <li key={p.id}>
                <Link href="/kepek" className="group relative block aspect-[4/3] overflow-hidden rounded-[10px] bg-surface-2 md:aspect-[4/5]">
                  <Image src={p.url} alt={p.alt} fill sizes="(min-width: 768px) 270px, 50vw" className="object-cover transition-transform duration-700 ease-[cubic-bezier(0.22,1,0.36,1)] group-hover:scale-[1.04]" />
                </Link>
              </li>
            ))}
          </ul>
          <p className="mt-5 text-center">
            <Link href="/kepek" className="inline-flex min-h-11 items-center gap-2 text-[0.78rem] font-semibold uppercase tracking-[0.14em] text-fg/80 underline-offset-[6px] hover:text-pop hover:underline">Mind a {photos.length} fotó <Icon name="arrow" size={15} /></Link>
          </p>
        </section>
      )}

      {/* ---------- 3. AVAILABILITY ---------- */}
      <section aria-labelledby="foglaltsag-title" className={`${SECTION} grid gap-10 py-20 md:py-28 lg:grid-cols-[0.9fr_1.4fr] lg:gap-20`}>
        <div>
          <h2 id="foglaltsag-title" className={H2}>Foglaltság</h2>
          <p className="mt-4 max-w-[40ch] text-soft">Válaszd ki az érkezést és a távozást: a foglalásnál már ezek a napok lesznek kijelölve.</p>
          <dl className="mt-8 grid grid-cols-2 gap-x-6 gap-y-5 border-t border-rule pt-6">
            {listing.checkinWindow && <Fact dt="Érkezés" dd={listing.checkinWindow} />}
            {listing.checkoutTime && <Fact dt="Távozás" dd={`${listing.checkoutTime}-ig`} />}
            <Fact dt="Minimum" dd={`${listing.minNights} éjszaka`} />
            <Fact dt="Online fizetés" dd="nincs" />
          </dl>
        </div>
        <AvailabilityTeaser phone={ctx.phone} email={listing.contactEmail} />
      </section>

      {/* ---------- 4. ABOUT ---------- */}
      <section aria-labelledby="haz-title" className={`${SECTION} grid gap-10 pb-20 md:grid-cols-[0.9fr_1.4fr] md:items-center md:gap-20 md:pb-28`}>
        <div className="flex flex-col gap-6">
          {facade && (
            <span className="relative block h-24 w-24 overflow-hidden rounded-full">
              <Image src={facade.url} alt={facade.alt} fill sizes="96px" className="object-cover" />
            </span>
          )}
          <h2 id="haz-title" className={H2}>A házról</h2>
        </div>
        <div>
          <p className="max-w-[56ch] text-[1.08rem] leading-[1.75] text-fg/85">{c.lead}</p>
          {chips.length > 0 && (
            <ul className="mt-6 grid gap-x-8 gap-y-2 text-soft sm:grid-cols-2">
              {[...chips, `Minimum ${listing.minNights} éjszaka`].map((x) => (
                <li key={x} className="flex items-center gap-3"><span aria-hidden="true" className="h-px w-4 shrink-0 bg-current" /> {x}</li>
              ))}
            </ul>
          )}
          <Link href="/a-haz" className="mt-7 inline-flex min-h-11 items-center gap-2 text-[0.78rem] font-semibold uppercase tracking-[0.14em] text-fg/80 underline-offset-[6px] hover:text-pop hover:underline">A ház részletesen <Icon name="arrow" size={15} /></Link>
        </div>
      </section>

      {/* ---------- 5. KEY FACTS on a photo ---------- */}
      {chips.length > 0 && (
        <section aria-label="A ház röviden" className="mx-auto max-w-[1400px] px-3 md:px-10">
          <div className="relative isolate overflow-hidden rounded-[14px] bg-deep px-4 py-14 md:px-10 md:py-24">
            {bandPhoto && <Image src={bandPhoto.url} alt="" fill sizes="100vw" className="-z-10 object-cover" />}
            {bandPhoto && <div aria-hidden="true" className="absolute inset-0 -z-10 bg-[rgb(18_22_20/0.18)]" />}
            <ul className="mx-auto grid max-w-4xl grid-cols-2 rounded-[10px] bg-surface shadow-[0_24px_60px_-28px_rgb(18_22_20/0.45)] md:grid-cols-4">
              {chips.map((x, i) => (
                <li key={x} className={`flex flex-col items-center gap-3 px-4 py-8 text-center ${i % 2 ? 'border-l border-rule' : ''} ${i > 1 ? 'border-t border-rule md:border-t-0' : ''} ${i === 2 ? 'md:border-l' : ''}`}>
                  <Icon name={chipIcon(x)} size={30} stroke={1.25} className="text-fg/80" />
                  <span className="text-[0.72rem] font-semibold uppercase tracking-[0.14em]">{x}</span>
                </li>
              ))}
            </ul>
          </div>
        </section>
      )}

      {/* ---------- 6. FEATURES ---------- */}
      {features.length > 0 && (
        <section aria-labelledby="felszereltseg-title" className={`${SECTION} py-20 md:py-28`}>
          <h2 id="felszereltseg-title" className={`${H2} mx-auto max-w-[20ch] text-center`}>Ami a házhoz tartozik</h2>
          <ul className="mt-14 grid gap-x-12 gap-y-14 sm:grid-cols-2 lg:grid-cols-3">
            {features.map((f) => (
              <li key={f.t} className="flex flex-col items-center text-center">
                <Icon name={f.i as IconName} size={34} stroke={1.15} className="text-fg/75" />
                <h3 className="mt-4 text-[1.4rem]">{f.t}</h3>
                <p className="mt-2 max-w-[30ch] text-[0.95rem] text-soft">{f.d}</p>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* ---------- 7. WHY US (split card, the one muted colour block) ---------- */}
      {why.length > 0 && (
        <section aria-labelledby="miert-title" className={SECTION}>
          <div className="grid gap-4 md:grid-cols-[1fr_1.2fr] md:gap-6">
            <div className="flex flex-col justify-center rounded-[10px] bg-deep p-8 text-deep-fg md:p-12">
              <h2 id="miert-title" className={H2}>Miért minket?</h2>
              <ul className="mt-7 space-y-5">
                {why.map((w) => (
                  <li key={w.t}>
                    <h3 className="text-[1.25rem]">{w.t}</h3>
                    <p className="mt-1 text-[0.95rem] text-deep-fg/80">{w.d}</p>
                  </li>
                ))}
              </ul>
              <Link href="/foglalas" className="btn btn-light mt-9 self-start">Foglalás</Link>
            </div>
            {splitPhoto && (
              <div className="relative min-h-[280px] overflow-hidden rounded-[10px] bg-surface-2">
                <Image src={splitPhoto.url} alt={splitPhoto.alt} fill sizes="(min-width: 768px) 55vw, 100vw" className="object-cover" />
              </div>
            )}
          </div>
        </section>
      )}

      {/* ---------- 8. GOOD TO KNOW ---------- */}
      {notes.length > 0 && (
        <section aria-labelledby="tudnivalok-title" className={`${SECTION} py-20 md:py-28`}>
          <h2 id="tudnivalok-title" className={`${H2} text-center`}>Jó tudni</h2>
          <ul className="mt-12 grid gap-10 md:grid-cols-3 md:gap-12">
            {notes.map((n) => (
              <li key={n} className="text-center">
                <span aria-hidden="true" className="mx-auto block h-px w-10 bg-pop" />
                <p className="mx-auto mt-5 max-w-[32ch] text-fg/85">{n}</p>
              </li>
            ))}
          </ul>
          <p className="mt-12 flex flex-wrap justify-center gap-x-8 gap-y-2">
            {ctx.docs.hazirend && <Link href="/hazirend" className="inline-flex min-h-11 items-center text-[0.78rem] font-semibold uppercase tracking-[0.14em] text-fg/80 underline-offset-[6px] hover:text-pop hover:underline">Teljes házirend</Link>}
            {listing.settings.menuGyik && ctx.docs.gyik && <Link href="/gyik" className="inline-flex min-h-11 items-center text-[0.78rem] font-semibold uppercase tracking-[0.14em] text-fg/80 underline-offset-[6px] hover:text-pop hover:underline">Gyakori kérdések</Link>}
          </p>
        </section>
      )}

      {/* ---------- 9. SISTER HOUSE ---------- */}
      {sister && (
        <section aria-labelledby="testver-title" className={`${SECTION} pb-20 md:pb-28`}>
          <a href={ctx.sisterOrigin} className="group grid overflow-hidden rounded-[10px] border border-rule bg-surface md:grid-cols-[1fr_1.1fr]">
            <span className="relative block aspect-[16/10] bg-surface-2 md:aspect-auto md:min-h-[300px]">
              {sisterCover ? (
                <Image src={sisterCover.url} alt="" fill sizes="(min-width: 768px) 45vw, 100vw" className="object-cover transition-transform duration-700 ease-[cubic-bezier(0.22,1,0.36,1)] group-hover:scale-[1.03]" />
              ) : (
                <span className="flex h-full items-center justify-center"><Mark site={sisterBrand.site} size={96} /></span>
              )}
            </span>
            <span className="flex flex-col justify-center gap-4 p-8 md:p-12">
              <span className="kicker">Testvérházunk Velencén</span>
              <span id="testver-title" className="font-display text-[clamp(1.7rem,3vw,2.4rem)] leading-tight">{qi > 0 ? pitch.slice(0, qi + 1) : sisterBrand.fullName}</span>
              {qi > 0 && <span className="text-soft">{pitch.slice(qi + 1).trim()}</span>}
              <span className="mt-2 inline-flex items-center gap-2 text-[0.78rem] font-semibold uppercase tracking-[0.14em] text-pop">{sisterBrand.fullName} <Icon name="out" size={15} /></span>
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
      <dt className="text-[0.68rem] font-semibold uppercase tracking-[0.16em] text-soft">{dt}</dt>
      <dd className="mt-1 text-[1.02rem]">{dd}</dd>
    </div>
  )
}
