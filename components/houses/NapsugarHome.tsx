import Image from 'next/image'
import { telHref } from '@/lib/brand'
import { Gallery } from '@/components/property/Gallery'
import { Reveal } from '@/components/property/Reveal'
import { LocationMap } from '@/components/property/LocationMap'
import { SeasonPostcard, type Season } from '@/components/property/SeasonPostcard'
import { Stamp } from '@/components/property/ui'
import { Booking, Faq, SisterTeaser, coverOf, type HomeData } from './shared'

// NAPSUGÁR — the family yard, as a 1970s Hungarian holiday postcard.
// Scene: a parent planning by daylight, kids around. The question is never
// "is the lake nice" but "what can the kids do, where do we sleep, what does
// it cost to arrive" — so the page leads with the yard, the season, and the
// practicalities (deposit, tourist tax, check-in) that competitors bury.

const find = (photos: HomeData['photos'], re: RegExp) => photos.find((p) => re.test(p.alt)) ?? null

export function NapsugarHome({ d, season }: { d: HomeData; season: Season }) {
  const { listing } = d
  const c = listing.content
  const cover = coverOf(d.photos)
  const winterShot = find(d.photos, /jakuzzi esti/i) ?? find(d.photos, /esti udvar kivilágított/i)
  const fire = find(d.photos, /tűzrakó/i)
  const tables = find(d.photos, /kerti asztal/i)
  const jacuzzi = find(d.photos, /esti udvar kivilágított/i)
  const used = new Set([cover?.id, winterShot?.id].filter(Boolean))
  const gallery = d.photos.filter((p) => !used.has(p.id))
  const yard = [tables, fire, jacuzzi].filter((p): p is NonNullable<typeof p> => !!p)

  return (
    <>
      {/* ---------------- HERO: a postcard on a sun-drenched page ---------------- */}
      <section className="relative overflow-hidden bg-band text-band-fg" aria-labelledby="hero-title">
        <SunRays />
        <div className="relative mx-auto grid max-w-7xl gap-14 px-4 pb-16 pt-28 md:px-8 lg:grid-cols-[1.05fr_1fr] lg:items-center lg:pb-24 lg:pt-32">
          <div className="rise">
            <h1 id="hero-title">
              <span className="block font-sans text-sm font-bold uppercase tracking-[0.14em]">Napsugár Vendégház · Velence</span>
              <span className="mt-4 block text-[clamp(3.2rem,8vw,6.6rem)]">Nyáron medence, télen jakuzzi.</span>
            </h1>
            <p className="mt-6 max-w-[34rem] text-lg md:text-xl">{c.lead}</p>
            <div className="mt-8 flex flex-wrap gap-3">
              <a href="#foglalas" className="btn btn-act">Szabad dátumok</a>
              <a href={telHref(d.phone)} className="btn btn-line !border-band-fg/40">{d.phone}</a>
            </div>
          </div>
          <SeasonPostcard
            initial={season}
            summer={cover && { url: cover.url, width: cover.width, height: cover.height, alt: cover.alt }}
            winter={winterShot && { url: winterShot.url, width: winterShot.width, height: winterShot.height, alt: winterShot.alt }}
            facts={{
              nyar: ['Kültéri medence 25–28 °C-os vízzel, 70–85 cm mély, szezonálisan', 'Árnyas udvar, kerti asztalok a fa alatt', 'A medence használata külön díjas lehet: egyeztessünk'],
              tel: ['Kültéri jakuzzi 20–40 °C-on, egész évben, a fedett teraszon', 'Padlófűtés, és mindkét hálóban saját fűtő-hűtő klíma', 'Esti udvar fényfüzérrel, bográccsal'],
            }}
          />
        </div>
      </section>

      {/* ---------------- WITH KIDS ---------------- */}
      <section id="gyerekkel" className="scroll-mt-4 bg-band-2 text-band-2-fg" aria-labelledby="gyerek-title">
        <div className="mx-auto grid max-w-7xl gap-10 px-4 py-20 md:grid-cols-[1fr_1.3fr] md:px-8 md:py-24">
          <h2 id="gyerek-title" className="text-[clamp(2.6rem,6vw,4.6rem)]">Gyerekkel jöttök?</h2>
          <ul className="grid gap-x-10 gap-y-6 sm:grid-cols-2">
            {[
              ['Etetőszék, kiságy', 'A házban megvan, és bébiétel is melegíthető.'],
              ['70–85 cm mély medence', 'Szezonálisan, 25–28 °C-os vízzel.'],
              ['Két hálószoba fent', 'Mindkettőben 3 összetolható egyszemélyes ágy.'],
              ['Falépcső az emeletre', 'Kisebb gyerekkel érdemes számolni vele.'],
            ].map(([t, x]) => (
              <li key={t} className="border-t border-band-2-fg/25 pt-4">
                <p className="text-lg font-bold">{t}</p>
                <p className="mt-1 opacity-85">{x}</p>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* ---------------- THE YARD ---------------- */}
      <section id="udvar" className="scroll-mt-4" aria-labelledby="udvar-title">
        <div className="mx-auto max-w-7xl px-4 py-20 md:px-8 md:py-28">
          <div className="grid gap-8 md:grid-cols-[1fr_1fr] md:items-end">
            <h2 id="udvar-title" className="text-[clamp(2.6rem,6vw,4.6rem)]">200 m² udvar, csak nektek</h2>
            <p className="max-w-[46ch] text-lg text-fg/85">
              Grill, bogrács, szalonnasütés a kőből rakott tűzrakónál. Három zárt parkolóhely a telken, mellette ingyenes utcai parkolás.
            </p>
          </div>
          {yard.length > 0 && (
            <div className="mt-12 grid gap-6 sm:grid-cols-3">
              {yard.map((p, i) => (
                <Reveal key={p.id} delay={i * 90}>
                  <figure className={`bg-[#FFFDF8] p-2.5 pb-10 shadow-[0_20px_40px_-24px_rgb(28_41_48/0.5)] ${i === 1 ? 'sm:translate-y-8 rotate-[1.2deg]' : 'rotate-[-1deg]'}`}>
                    <div className="relative aspect-[4/3] overflow-hidden"><Image src={p.url} alt={p.alt} fill sizes="(min-width: 640px) 30vw, 92vw" className="object-cover" /></div>
                    <figcaption className="mt-3 px-1 font-display text-lg text-[#1C2930]">{p.alt}</figcaption>
                  </figure>
                </Reveal>
              ))}
            </div>
          )}
        </div>
      </section>

      {/* ---------------- THE HOUSE: two postcard backs ---------------- */}
      <section id="haz" className="scroll-mt-4 bg-surface-2" aria-labelledby="haz-title">
        <div className="mx-auto max-w-7xl px-4 py-20 md:px-8 md:py-28">
          <h2 id="haz-title" className="text-[clamp(2.6rem,6vw,4.6rem)]">90 m², két szint</h2>
          <div className="mt-12 grid gap-8 md:grid-cols-2">
            {(c.spaces ?? []).map((s, i) => (
              <Reveal key={s.tag} delay={i * 100}>
                <article className="relative grid h-full grid-cols-[1fr_auto] gap-6 bg-[#FFFDF8] p-6 shadow-[0_20px_40px_-26px_rgb(28_41_48/0.45)] md:p-8">
                  <div className="border-r border-dashed border-rule pr-6">
                    <p className="text-sm font-bold uppercase tracking-[0.14em] text-pop">{s.tag}</p>
                    <h3 className="mt-2 text-3xl text-[#1C2930]">{s.title}</h3>
                    <ul className="mt-5 space-y-3 text-[#1C2930]">
                      {s.items.map((it) => (
                        <li key={it} className="border-b border-[#1C2930]/15 pb-2">{it}</li>
                      ))}
                    </ul>
                  </div>
                  <div className="hidden w-[88px] sm:block"><Stamp className="scale-[0.8] origin-top-right" caption={s.tag} /></div>
                </article>
              </Reveal>
            ))}
          </div>
          {c.equipment?.length ? (
            <div className="mt-14">
              <h3 className="text-3xl">Ami a házban van</h3>
              <ul className="mt-5 flex flex-wrap gap-2">
                {c.equipment.map((e) => <li key={e} className="rounded-full border-2 border-fg/15 bg-surface px-4 py-2 text-[0.95rem] font-medium">{e}</li>)}
              </ul>
            </div>
          ) : null}
        </div>
      </section>

      {/* ---------------- POSTCARDS (gallery) ---------------- */}
      {gallery.length > 0 && (
        <section id="kepeslapok" className="scroll-mt-4" aria-labelledby="kepek-title">
          <div className="mx-auto max-w-7xl px-4 py-20 md:px-8 md:py-28">
            <h2 id="kepek-title" className="text-[clamp(2.6rem,6vw,4.6rem)]">{gallery.length} kép a házról</h2>
            <div className="mt-10"><Gallery items={gallery.map((p) => ({ id: p.id, url: p.url, width: p.width, height: p.height, alt: p.alt }))} /></div>
          </div>
        </section>
      )}

      {/* ---------------- BOOKING ---------------- */}
      <section id="foglalas" className="scroll-mt-4 border-y-[10px] border-band" aria-labelledby="foglalas-title">
        <div className="mx-auto max-w-6xl px-4 py-20 md:px-8 md:py-28">
          <div className="flex flex-wrap items-end justify-between gap-6">
            <h2 id="foglalas-title" className="text-[clamp(2.6rem,6vw,4.6rem)]">Szabad dátumok</h2>
            <p className="max-w-md text-fg/80">A kiválasztott napokat a visszaigazolásig fenntartjuk. Most nem vonunk le pénzt: visszaigazolás e-mailben, fizetés a helyszínen.</p>
          </div>
          <div className="mt-10"><Booking d={d} /></div>
        </div>
      </section>

      {/* ---------------- ARRIVAL FACTS (what competitors bury) ---------------- */}
      <section id="tudnivalok" className="scroll-mt-4" aria-labelledby="tudnivalok-title">
        <div className="mx-auto grid max-w-7xl gap-12 px-4 py-20 md:grid-cols-[1fr_1.6fr] md:px-8 md:py-28">
          <div>
            <h2 id="tudnivalok-title" className="text-4xl md:text-5xl">Érkezés előtt, őszintén</h2>
            <p className="mt-4 max-w-[36ch] text-fg/80">Minden, ami a helyszínen pénzbe kerülhet vagy számít, egy helyen.</p>
          </div>
          <dl className="grid gap-x-10 border-t border-rule sm:grid-cols-2">
            {[
              ['Érkezés', listing.checkinWindow ? `${listing.checkinWindow}; később csak előzetes jelzéssel` : null],
              ['Távozás', listing.checkoutTime ? `${listing.checkoutTime}-ig` : null],
              ['Kaució', '80 000 Ft érkezéskor, károkozás nélkül maradéktalanul visszajár'],
              ['Idegenforgalmi adó', '800 Ft / fő / éj 18 év felett, a helyszínen'],
              ['Fizetés', 'Legkésőbb az érkezés napján, forintban vagy euróban'],
              ['Medence', 'Szezonálisan; a használata külön díjas lehet, előre egyeztetjük'],
              ['Energiafelár', 'Fűtés és klíma használatakor fogyasztás szerint lehet'],
              ['Minimum', `${listing.minNights} éjszaka, 1 éjszaka felárral`],
              ['Ár', listing.pricingMode === 'fixed' ? 'A foglalóban tájékoztató végösszeget látsz' : 'Egyedi ajánlat, a visszaigazolással együtt'],
            ].filter((r): r is [string, string] => !!r[1]).map(([t, v]) => (
              <div key={t} className="border-b border-rule py-5">
                <dt className="font-bold text-pop">{t}</dt>
                <dd className="mt-1 text-fg/85">{v}</dd>
              </div>
            ))}
          </dl>
        </div>
      </section>

      {listing.geo && listing.address && (
        <section aria-labelledby="terkep-title" className="border-t border-rule">
          <div className="mx-auto grid max-w-7xl gap-8 px-4 py-20 md:grid-cols-[1fr_2fr] md:px-8 md:py-24">
            <div>
              <h2 id="terkep-title" className="text-4xl md:text-5xl">{listing.address}</h2>
              <a className="mt-6 inline-block py-2 font-bold text-pop underline underline-offset-4" href={`https://www.openstreetmap.org/?mlat=${listing.geo.lat}&mlon=${listing.geo.lng}#map=17/${listing.geo.lat}/${listing.geo.lng}`}>
                Megnyitás térképen <span aria-hidden="true">↗</span>
              </a>
            </div>
            <div className="h-[340px] overflow-hidden rounded-[var(--radius-xl)] border-2 border-rule md:h-[420px]">
              <LocationMap lat={listing.geo.lat} lng={listing.geo.lng} label={listing.address} />
            </div>
          </div>
        </section>
      )}

      <div className="border-t border-rule"><Faq items={c.faq ?? []} /></div>
      <SisterTeaser d={d} />
    </>
  )
}

/** Quiet sunburst behind the hero: the postcard's printed sun, decorative only. */
function SunRays() {
  const rays = Array.from({ length: 24 }, (_, i) => i * 15)
  return (
    <svg aria-hidden="true" viewBox="-100 -100 200 200" className="pointer-events-none absolute -right-[30vw] -top-[30vw] h-[90vw] w-[90vw] opacity-[0.18] lg:-right-[12vw] lg:-top-[22vw] lg:h-[60vw] lg:w-[60vw]">
      {rays.map((deg) => (
        <path key={deg} d="M0 0 L100 -6 L100 6 Z" fill="#FFF7E8" transform={`rotate(${deg})`} />
      ))}
    </svg>
  )
}
