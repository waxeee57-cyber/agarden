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
        {strip.map((p, i) => (
          <li key={p.id} data-reveal style={{ '--i': i } as React.CSSProperties}>
            <button
              type="button"
              onClick={() => setOpen(Math.max(0, items.findIndex((x) => x.id === p.id)))}
              aria-label={`${p.alt || 'Fotó'}, nagyítás`}
              className="zoom-tile relative block aspect-[4/3] w-full cursor-zoom-in rounded-2xl bg-surface-2 md:aspect-[4/5]"
            >
              <Image src={p.url} alt={p.alt} fill sizes="(min-width: 768px) 270px, 50vw" className="object-cover" />
            </button>
          </li>
        ))}
      </ul>
      {open !== null && <Lightbox items={items} index={open} onIndex={setOpen} onClose={() => setOpen(null)} />}
    </>
  )
}
