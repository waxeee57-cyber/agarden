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
        {strip.map((p) => (
          <li key={p.id}>
            <button
              type="button"
              onClick={() => setOpen(Math.max(0, items.findIndex((x) => x.id === p.id)))}
              aria-label={`${p.alt || 'Fotó'}, nagyítás`}
              className="group relative block aspect-[4/3] w-full cursor-zoom-in overflow-hidden rounded-[10px] bg-surface-2 md:aspect-[4/5]"
            >
              <Image src={p.url} alt={p.alt} fill sizes="(min-width: 768px) 270px, 50vw" className="object-cover transition-transform duration-700 ease-[cubic-bezier(0.22,1,0.36,1)] group-hover:scale-[1.04]" />
              <span aria-hidden="true" className="absolute inset-0 bg-[rgb(18_22_20/0)] transition-colors duration-300 group-hover:bg-[rgb(18_22_20/0.12)]" />
            </button>
          </li>
        ))}
      </ul>
      {open !== null && <Lightbox items={items} index={open} onIndex={setOpen} onClose={() => setOpen(null)} />}
    </>
  )
}
