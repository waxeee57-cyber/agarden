import { Suspense } from 'react'
import Image from 'next/image'
import type { Listing, Photo } from '@/lib/listing'
import type { Site } from '@/lib/site-map'
import { BRANDS } from '@/lib/brand'
import { BookingWidget, type ShareInfo } from '@/components/property/BookingWidget'
import { Mark, Stamp } from '@/components/property/ui'

export type HomeData = {
  listing: Listing
  photos: Photo[]
  sister: Listing | null
  sisterPhotos: Photo[]
  origin: string
  sisterOrigin: string
  phone: string
  singleNightAllowed: boolean
}

export const coverOf = (photos: Photo[]) => photos.find((p) => p.isCover) ?? photos[0] ?? null

export function Faq({ items, title = 'Gyakori kérdések' }: { items: { q: string; a: string }[]; title?: string }) {
  if (!items.length) return null
  return (
    <section id="gyik" className="scroll-mt-4" aria-labelledby="gyik-title">
      <div className="mx-auto grid max-w-7xl gap-10 px-4 py-20 md:grid-cols-[1fr_1.6fr] md:px-8 md:py-28">
        <h2 id="gyik-title" className="text-4xl md:text-6xl">{title}</h2>
        <div className="divide-y divide-rule border-y border-rule">
          {items.map((f) => (
            <details key={f.q} className="group">
              <summary className="flex min-h-16 cursor-pointer list-none items-center justify-between gap-6 py-4 text-lg font-semibold [&::-webkit-details-marker]:hidden">
                {f.q}
                <span aria-hidden="true" className="text-2xl text-pop transition-transform group-open:rotate-45">+</span>
              </summary>
              <p className="max-w-[65ch] pb-6 pr-10 text-fg/85">{f.a}</p>
            </details>
          ))}
        </div>
      </div>
    </section>
  )
}

/** The booking block. The widget itself is skin-agnostic (tokens). */
export function Booking({ d, share }: { d: HomeData; share?: ShareInfo }) {
  const { listing } = d
  return (
    <Suspense fallback={<div className="panel min-h-[640px]" aria-hidden="true" />}>
      <BookingWidget
        listing={{
          siteName: listing.siteName,
          capacityMax: listing.capacityMax,
          capacityExtra: listing.capacityExtra,
          minNights: listing.minNights,
          pricingMode: listing.pricingMode,
          phone: d.phone,
          email: listing.contactEmail,
          singleNightAllowed: d.singleNightAllowed,
        }}
        sister={{ name: BRANDS[d.sister?.slug ?? (listing.slug === 'velence' ? 'napsugar' : 'velence')].fullName, origin: d.sisterOrigin, pitch: d.sister?.content.sister_pitch ?? '' }}
        share={share}
      />
    </Suspense>
  )
}

/**
 * The sister house, rendered in ITS OWN skin — a Napsugár postcard on the
 * Garden night page, a Garden night card on the Napsugár page. One image,
 * one line, one link to the other domain. No content duplication.
 */
export function SisterTeaser({ d }: { d: HomeData }) {
  if (!d.sister) return null
  const s: Site = d.sister.slug
  const cover = coverOf(d.sisterPhotos)
  const b = BRANDS[s]
  // "Kisebbek vagytok? A Napsugár …" -> headline = the question, body = the answer
  const pitch = d.sister.content.sister_pitch ?? ''
  const qi = pitch.indexOf('?')
  const pitchHead = qi > 0 ? pitch.slice(0, qi + 1) : b.fullName
  const pitchBody = qi > 0 ? pitch.slice(qi + 1).trim() : pitch
  return (
    <section aria-labelledby="testver-title" data-skin={s === 'velence' ? 'garden' : 'napsugar'} className="skin-root !min-h-0">
      <div className="mx-auto grid max-w-7xl items-center gap-10 px-4 py-20 md:grid-cols-[1fr_1.1fr] md:px-8 md:py-24">
        <div>
          <p className="kicker">Testvérházunk Velencén</p>
          <h2 id="testver-title" className="mt-4 text-4xl md:text-6xl">{pitchHead}</h2>
          {pitchBody && <p className="mt-5 max-w-[40ch] text-lg text-fg/85">{pitchBody}</p>}
          <a href={d.sisterOrigin} className="btn btn-act mt-8">{b.fullName} <span aria-hidden="true">↗</span></a>
        </div>
        <a href={d.sisterOrigin} tabIndex={-1} aria-hidden="true" className={`group relative block ${s === 'napsugar' ? 'rotate-[1.5deg] bg-[#FFFDF8] p-3 pb-12 shadow-[0_30px_60px_-30px_rgb(0_0_0/0.6)]' : 'overflow-hidden rounded-[4px] border border-rule'}`}>
          <span className="relative block aspect-[4/3] overflow-hidden bg-surface-2">
            {cover ? (
              <Image src={cover.url} alt="" fill sizes="(min-width: 768px) 50vw, 100vw" className="object-cover transition-transform duration-700 group-hover:scale-[1.03]" />
            ) : (
              <span className="flex h-full items-center justify-center"><Mark site={s} size={96} /></span>
            )}
          </span>
          {s === 'napsugar' && <span className="absolute -right-4 -top-9 rotate-[8deg]"><Stamp /></span>}
          {s === 'napsugar' && <span className="absolute bottom-3 left-4 font-display text-xl text-[#1C2930]">Üdvözlet a Napsugárból!</span>}
        </a>
      </div>
    </section>
  )
}
