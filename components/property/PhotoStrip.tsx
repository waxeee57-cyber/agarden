'use client'

import { useState } from 'react'
import Image from 'next/image'
import { Lightbox, type LightboxItem } from './Lightbox'

// Homepage photo strip: a click enlarges the photo right here (no jump to the
// gallery page); the viewer pages through every photo of the house.
export function PhotoStrip({ strip, all }: { strip: LightboxItem[]; all: LightboxItem[] }) {
  const [open, setOpen] = useState<number | null>(null)
  const items = all.length ? all : strip
  return (
    <>
      <ul className="grid grid-cols-2 gap-3 md:grid-cols-4 md:gap-6">
        {strip.map((p, i) => {
          const more = i === strip.length - 1 ? items.length - strip.length : 0
          return (
          <li key={p.id} data-reveal style={{ '--i': i } as React.CSSProperties}>
            <button
              type="button"
              onClick={() => setOpen(Math.max(0, items.findIndex((x) => x.id === p.id)))}
              aria-label={more > 0 ? `${p.alt || 'Fotó'}, nagyítás; további ${more} fotó a nézegetőben` : `${p.alt || 'Fotó'}, nagyítás`}
              className="zoom-tile relative block aspect-[4/3] w-full cursor-zoom-in rounded-2xl bg-surface-2 md:aspect-[4/5]"
            >
              <Image src={p.url} alt={p.alt} fill sizes="(min-width: 768px) 270px, 50vw" className="object-cover" />
              {more > 0 && (
                <span className="absolute inset-0 flex flex-col items-center justify-center gap-1.5 rounded-2xl bg-[rgb(18_20_22/0.5)] text-white">
                  <span className="font-display text-[2rem] leading-none md:text-[2.6rem]">+{more}</span>
                  <span className="font-ui text-[11px] font-bold uppercase tracking-[0.2em]">további fotó</span>
                </span>
              )}
            </button>
          </li>
          )
        })}
      </ul>
      {open !== null && <Lightbox items={items} index={open} onIndex={setOpen} onClose={() => setOpen(null)} />}
    </>
  )
}
