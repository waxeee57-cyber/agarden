import { Suspense } from 'react'
import Image from 'next/image'
import { notFound } from 'next/navigation'
import { isSite, siteOrigin, sisterOf } from '@/lib/site-map'
import { getListing, getPhotos } from '@/lib/listing'
import { BRANDS, telHref } from '@/lib/brand'
import { BookingWidget } from '@/components/property/BookingWidget'
import { Gallery } from '@/components/property/Gallery'
import { Reveal } from '@/components/property/Reveal'
import { MobileStickyCTA } from '@/components/property/MobileStickyCTA'
import { LocationMap } from '@/components/property/LocationMap'
import { SiteHeader, SiteFooter } from '@/components/property/SiteChrome'
import { RippleDivider, Seal, Mark } from '@/components/property/ui'
import { JsonLd, lodgingJsonLd, websiteJsonLd, breadcrumbJsonLd, faqJsonLd } from '@/components/property/JsonLd'

// ISR: rebuilt at most every 5 minutes; admin edits call revalidatePath.
export const revalidate = 300

export default async function HousePage({ params }: { params: Promise<{ site: string }> }) {
  const { site } = await params
  if (!isSite(site)) notFound()
  const sisterSite = sisterOf(site)
  const [listing, sister] = await Promise.all([getListing(site), getListing(sisterSite)])
  if (!listing) notFound()
  const [photos, sisterPhotos] = await Promise.all([getPhotos(listing.id), sister ? getPhotos(sister.id) : Promise.resolve([])])

  const c = listing.content
  const brand = BRANDS[site]
  const origin = siteOrigin(site)
  const sisterOrigin = siteOrigin(sisterSite)
  const phone = listing.contactPhone ?? brand.phone
  const cover = photos.find((p) => p.isCover) ?? photos[0] ?? null
  const sisterCover = sisterPhotos.find((p) => p.isCover) ?? sisterPhotos[0] ?? null
  const singleNightAllowed = listing.surcharges.some((s) => s.code === 'single_night' && s.active)

  const facts: [string, string][] = [
    ['Létszám', `legfeljebb ${listing.capacityMax}+${listing.capacityExtra} fő`],
    ['Minimum', `${listing.minNights} éjszaka`],
    ...(listing.checkinWindow ? [['Érkezés', listing.checkinWindow] as [string, string]] : []),
    ...(listing.checkoutTime ? [['Távozás', `${listing.checkoutTime}-ig`] as [string, string]] : []),
    ['Árazás', listing.pricingMode === 'fixed' ? 'A foglalónál tájékoztató végösszeget mutatunk.' : 'Egyedi ajánlat alapján.'],
    ...(listing.ntakId ? [['NTAK', listing.ntakId] as [string, string]] : []),
  ]

  return (
    <>
      <JsonLd data={[lodgingJsonLd(listing, origin, photos), websiteJsonLd(brand.fullName, origin), breadcrumbJsonLd(origin, [{ name: brand.fullName, path: '/' }]), ...(c.faq?.length ? [faqJsonLd(c.faq)] : [])]} />

      <SiteHeader site={site} sisterOrigin={sisterOrigin} overlay />

      <main id="tartalom">
        {/* ---------------- HERO ---------------- */}
        <section className="relative min-h-[88svh] overflow-hidden bg-deep text-cream" aria-labelledby="hero-title">
          {cover && (
            <Image src={cover.url} alt={cover.alt} fill preload sizes="100vw" quality={70} className="object-cover" />
          )}
          <div
            className="absolute inset-0"
            style={{
              background:
                'linear-gradient(90deg, rgb(0 0 0 / 0.42) 0%, rgb(0 0 0 / 0.12) 55%, transparent 75%), linear-gradient(180deg, rgb(0 0 0 / 0.45) 0%, rgb(0 0 0 / 0.2) 38%, color-mix(in oklab, var(--color-deep-700) 90%, transparent) 100%)',
            }}
            aria-hidden="true"
          />
          <div className="relative mx-auto flex min-h-[88svh] max-w-6xl flex-col justify-end px-4 pb-14 pt-28 md:px-8 md:pb-20">
            <div className="hero-stagger max-w-2xl">
              <p className="label-caps !text-accent">{c.eyebrow}</p>
              <h1 id="hero-title" className="mt-3 text-5xl leading-[0.98] md:text-7xl">{listing.siteName}</h1>
              <p className="mt-5 max-w-xl text-lg text-cream/95 md:text-xl">{c.lead}</p>
              <div className="mt-7 flex flex-wrap gap-3">
                <a href="#foglalas" className="btn btn-primary">Foglalás, ajánlatkérés</a>
                <a href={telHref(phone)} className="btn btn-ghost !border-cream/45 !text-cream hover:!bg-cream/10">{phone}</a>
              </div>
              {c.highlights?.length ? (
                <ul className="mt-8 flex flex-wrap gap-x-6 gap-y-2 text-sm text-cream/90">
                  {c.highlights.map((s) => (
                    <li key={s} className="flex items-center gap-2"><span className="h-1.5 w-1.5 rounded-full bg-accent" aria-hidden="true" />{s}</li>
                  ))}
                </ul>
              ) : null}
            </div>
          </div>
          <div className="absolute right-4 top-24 hidden sm:block md:right-10 md:top-28"><Seal site={site} /></div>
        </section>

        {/* ---------------- INTRO ---------------- */}
        <section className="bg-cream">
          <div className="mx-auto max-w-3xl px-4 py-20 text-center md:px-8 md:py-28">
            <Reveal>
              <p className="label-caps">{c.intro_eyebrow}</p>
              <h2 className="mt-4 text-3xl md:text-4xl">{c.intro_title}</h2>
              <p className="mt-5 text-lg leading-relaxed text-ink/85">{c.intro_body}</p>
            </Reveal>
          </div>
          <RippleDivider tone="reed" className="mx-auto max-w-5xl" />
        </section>

        {/* ---------------- SPACES ---------------- */}
        {c.spaces?.length ? (
          <section id="terek" className="scroll-mt-4 bg-paper" aria-labelledby="terek-title">
            <div className="mx-auto max-w-6xl px-4 py-20 md:px-8 md:py-28">
              <Reveal><p className="label-caps">A ház</p><h2 id="terek-title" className="mt-3 text-3xl md:text-4xl">{c.spaces_title}</h2></Reveal>
              <div className="mt-12 grid gap-6 md:grid-cols-2">
                {c.spaces.map((s, i) => (
                  <Reveal key={s.tag} delay={i * 80}>
                    <div className="card h-full p-7 md:p-8">
                      <span className="label-caps">{s.tag}</span>
                      <h3 className="mt-2 text-2xl">{s.title}</h3>
                      <ul className="mt-5 space-y-2.5">
                        {s.items.map((it) => (
                          <li key={it} className="flex gap-3 text-ink/85"><span className="mt-2.5 h-1.5 w-1.5 shrink-0 rounded-full bg-clay" aria-hidden="true" /><span>{it}</span></li>
                        ))}
                      </ul>
                    </div>
                  </Reveal>
                ))}
              </div>
            </div>
          </section>
        ) : null}

        {/* ---------------- WELLNESS (signature block) ---------------- */}
        {c.wellness?.length ? (
          <section id="wellness" className="relative scroll-mt-4 overflow-hidden bg-deep text-cream" aria-labelledby="wellness-title">
            <div className="mx-auto max-w-6xl px-4 py-20 md:px-8 md:py-28">
              <Reveal><p className="label-caps !text-accent">{c.wellness_eyebrow}</p><h2 id="wellness-title" className="mt-3 max-w-3xl text-3xl md:text-5xl">{c.wellness_title}</h2></Reveal>
              <div className={`mt-12 grid gap-6 ${c.wellness.length === 3 ? 'sm:grid-cols-3' : 'sm:grid-cols-2'}`}>
                {c.wellness.map((w, i) => (
                  <Reveal key={w.t} delay={i * 90}>
                    <div className="h-full border-t border-cream/25 pt-6">
                      <div className="font-display text-4xl text-accent tnum md:text-5xl">{w.k}</div>
                      <h3 className="mt-2 text-2xl text-cream">{w.t}</h3>
                      <p className="mt-2 max-w-sm text-cream/85">{w.d}</p>
                    </div>
                  </Reveal>
                ))}
              </div>
            </div>
            <RippleDivider tone="reed" className="opacity-30" />
          </section>
        ) : null}

        {/* ---------------- AMENITIES ---------------- */}
        <section className="bg-paper-2" aria-labelledby="praktikum-title">
          <div className="mx-auto max-w-6xl px-4 py-20 md:px-8 md:py-28">
            <Reveal><p className="label-caps">Kényelem</p><h2 id="praktikum-title" className="mt-3 text-3xl md:text-4xl">{c.amenities_title}</h2></Reveal>
            <dl className="mt-10 grid gap-x-10 gap-y-7 sm:grid-cols-2 lg:grid-cols-4">
              {c.amenities?.map((a) => (
                <div key={a.t} className="border-t border-line pt-4">
                  <dt className="font-display text-xl text-deep">{a.t}</dt>
                  <dd className="mt-1.5 text-ink/80">{a.d}</dd>
                </div>
              ))}
            </dl>
            {c.equipment?.length ? (
              <div className="mt-12">
                <h3 className="text-xl text-deep">Felszereltség</h3>
                <ul className="mt-4 flex flex-wrap gap-2">
                  {c.equipment.map((e) => <li key={e} className="rounded-full border border-line bg-cream px-3.5 py-1.5 text-sm">{e}</li>)}
                </ul>
              </div>
            ) : null}
          </div>
        </section>

        {/* ---------------- GALLERY (real photos only) ---------------- */}
        {photos.length > 1 && (
          <section id="galeria" className="scroll-mt-4 bg-cream" aria-labelledby="galeria-title">
            <div className="mx-auto max-w-6xl px-4 py-20 md:px-8 md:py-28">
              <Reveal><p className="label-caps">Galéria</p><h2 id="galeria-title" className="mt-3 text-3xl md:text-4xl">Nézz körül</h2></Reveal>
              <div className="mt-10"><Gallery items={photos.filter((p) => p.id !== cover?.id).map((p) => ({ id: p.id, url: p.url, width: p.width, height: p.height, alt: p.alt }))} /></div>
            </div>
          </section>
        )}

        {/* ---------------- BOOKING ---------------- */}
        <section id="foglalas" className="scroll-mt-4 bg-paper" aria-labelledby="foglalas-title">
          <div className="mx-auto max-w-5xl px-4 py-20 md:px-8 md:py-28">
            <Reveal>
              <p className="label-caps">Foglalás</p>
              <h2 id="foglalas-title" className="mt-3 text-3xl md:text-4xl">Válassz dátumot, vagy kérj ajánlatot</h2>
              <p className="mt-4 max-w-2xl text-ink/80">
                A foglalási kérelem a kiválasztott napokat a visszaigazolásig fenntartja. Most nem vonunk le pénzt — visszaigazolás e-mailben, fizetés a helyszínen.
              </p>
            </Reveal>
            <div className="mt-10">
              <Suspense fallback={<div className="card min-h-[640px]" aria-hidden="true" />}>
                <BookingWidget
                  listing={{
                    siteName: listing.siteName,
                    capacityMax: listing.capacityMax,
                    capacityExtra: listing.capacityExtra,
                    minNights: listing.minNights,
                    pricingMode: listing.pricingMode,
                    phone,
                    email: listing.contactEmail,
                    singleNightAllowed,
                  }}
                  sister={{ name: BRANDS[sisterSite].fullName, origin: sisterOrigin, pitch: sister?.content.sister_pitch ?? '' }}
                />
              </Suspense>
            </div>
          </div>
        </section>

        {/* ---------------- RULES / FACTS ---------------- */}
        <section id="tudnivalok" className="scroll-mt-4 bg-cream" aria-labelledby="tudnivalok-title">
          <div className="mx-auto grid max-w-6xl gap-12 px-4 py-20 md:grid-cols-2 md:px-8 md:py-24">
            <div>
              <p className="label-caps">Tudnivalók</p>
              <h2 id="tudnivalok-title" className="mt-3 text-3xl">Jó, ha tudod</h2>
              <dl className="mt-8 divide-y divide-line border-y border-line">
                {facts.map(([t, d]) => (
                  <div key={t} className="grid grid-cols-[8rem_1fr] gap-4 py-3.5">
                    <dt className="font-semibold text-deep">{t}</dt>
                    <dd className="text-ink/85">{d}</dd>
                  </div>
                ))}
              </dl>
            </div>
            {listing.houseRules.length ? (
              <div>
                <p className="label-caps">Házirend</p>
                <h2 className="mt-3 text-3xl">Röviden</h2>
                <ul className="mt-8 space-y-4">
                  {listing.houseRules.map((r) => (
                    <li key={r.t} className="flex gap-3">
                      <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-accent" aria-hidden="true" />
                      <span><strong className="font-semibold text-deep">{r.t}</strong>{r.d ? <span className="text-ink/80">. {r.d}</span> : null}</span>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
          </div>
        </section>

        {/* ---------------- MAP (only with a real address) ---------------- */}
        {listing.geo && listing.address && (
          <section className="bg-paper" aria-labelledby="terkep-title">
            <div className="mx-auto max-w-6xl px-4 py-20 md:px-8 md:py-24">
              <p className="label-caps">Megközelítés</p>
              <h2 id="terkep-title" className="mt-3 text-3xl">{listing.address}</h2>
              <div className="mt-8 h-[340px] overflow-hidden rounded-[var(--radius-xl)] border border-line md:h-[420px]">
                <LocationMap lat={listing.geo.lat} lng={listing.geo.lng} label={listing.address} />
              </div>
              <a className="mt-4 inline-block py-2 font-semibold text-action underline underline-offset-4" href={`https://www.openstreetmap.org/?mlat=${listing.geo.lat}&mlon=${listing.geo.lng}#map=17/${listing.geo.lat}/${listing.geo.lng}`}>
                Megnyitás térképen <span aria-hidden="true">↗</span>
              </a>
            </div>
          </section>
        )}

        {/* ---------------- FAQ ---------------- */}
        {c.faq?.length ? (
          <section id="gyik" className="scroll-mt-4 bg-cream" aria-labelledby="gyik-title">
            <div className="mx-auto max-w-3xl px-4 py-20 md:px-8 md:py-24">
              <p className="label-caps">GYIK</p>
              <h2 id="gyik-title" className="mt-3 text-3xl md:text-4xl">Gyakori kérdések</h2>
              <div className="mt-8 divide-y divide-line border-y border-line">
                {c.faq.map((f) => (
                  <details key={f.q} className="group py-1">
                    <summary className="flex min-h-14 cursor-pointer list-none items-center justify-between gap-4 py-3 font-display text-lg text-deep [&::-webkit-details-marker]:hidden">
                      {f.q}
                      <span aria-hidden="true" className="text-2xl text-action transition-transform group-open:rotate-45">+</span>
                    </summary>
                    <p className="pb-5 pr-8 text-ink/85">{f.a}</p>
                  </details>
                ))}
              </div>
            </div>
          </section>
        ) : null}

        {/* ---------------- SISTER HOUSE ---------------- */}
        {sister && (
          <section className="bg-paper-2" aria-labelledby="testver-title">
            <div className="mx-auto grid max-w-6xl items-center gap-10 px-4 py-20 md:grid-cols-[1fr_1.1fr] md:px-8 md:py-24">
              <div>
                <p className="label-caps">Testvérházunk</p>
                <h2 id="testver-title" className="mt-3 text-3xl md:text-4xl">{sister.content.sister_pitch}</h2>
                <p className="mt-4 text-ink/85">
                  {BRANDS[sisterSite].fullName}: {sister.tagline?.toLowerCase()}. Szintén Velencén, saját foglalással.
                </p>
                <a href={sisterOrigin} className="btn btn-dark mt-7">Tovább: {BRANDS[sisterSite].fullName} <span aria-hidden="true">↗</span></a>
              </div>
              <a href={sisterOrigin} className="group relative block aspect-[4/3] overflow-hidden rounded-[var(--radius-2xl)] border border-line bg-deep" tabIndex={-1} aria-hidden="true">
                {sisterCover ? (
                  <Image src={sisterCover.url} alt="" fill sizes="(min-width: 768px) 50vw, 100vw" className="object-cover transition-transform duration-700 group-hover:scale-[1.03]" />
                ) : (
                  <span className="flex h-full items-center justify-center"><Mark site={sisterSite} size={96} /></span>
                )}
              </a>
            </div>
          </section>
        )}
      </main>

      <SiteFooter listing={listing} sisterOrigin={sisterOrigin} />
      <MobileStickyCTA phone={phone} />
    </>
  )
}
