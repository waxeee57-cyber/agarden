'use client'

import { useState } from 'react'
import Image from 'next/image'
import { Lightbox, type LightboxItem } from './Lightbox'

export type GalleryItem = LightboxItem

// Uniform grid (reference gallery: equal portrait tiles, 12 px corners) of the house's real photos (listing_photos). Every tile
// opens the shared lightbox. No placeholder tiles, ever.
export function Gallery({ items }: { items: GalleryItem[] }) {
  const [open, setOpen] = useState<number | null>(null)
  return (
    <>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 md:gap-5 lg:grid-cols-4">
        {items.map((item, idx) => (
          <button
            data-reveal
            style={{ '--i': idx % 4 } as React.CSSProperties}
            key={item.id}
            type="button"
            onClick={() => setOpen(idx)}
            className="zoom-tile relative block aspect-[4/5] w-full cursor-zoom-in rounded-2xl bg-surface-2"
            aria-label={`${item.alt || 'Fotó'}, nagyítás`}
          >
            <Image
              src={item.url}
              alt={item.alt}
              fill
              sizes="(min-width: 1024px) 270px, (min-width: 768px) 33vw, 50vw"
              className="object-cover"
            />
          </button>
        ))}
      </div>
      {open !== null && <Lightbox items={items} index={open} onIndex={setOpen} onClose={() => setOpen(null)} />}
    </>
  )
}
