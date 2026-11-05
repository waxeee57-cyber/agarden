'use client'

import { useState } from 'react'
import Image from 'next/image'
import { Lightbox, type LightboxItem } from './Lightbox'

export type GalleryItem = LightboxItem

// Masonry gallery of the house's real photos (listing_photos). Every tile
// opens the shared lightbox. No placeholder tiles, ever.
export function Gallery({ items }: { items: GalleryItem[] }) {
  const [open, setOpen] = useState<number | null>(null)
  return (
    <>
      <div className="columns-2 gap-3 md:columns-3 md:gap-4">
        {items.map((item, idx) => (
          <button
            key={item.id}
            type="button"
            onClick={() => setOpen(idx)}
            className="group mb-3 block w-full overflow-hidden rounded-[var(--radius-lg)] md:mb-4"
            aria-label={`${item.alt || 'Fotó'}, nagyítás`}
          >
            <Image
              src={item.url}
              alt={item.alt}
              width={item.width}
              height={item.height}
              sizes="(min-width: 768px) 33vw, 50vw"
              className="h-auto w-full transition-transform duration-700 ease-[cubic-bezier(0.22,1,0.36,1)] group-hover:scale-[1.03]"
            />
          </button>
        ))}
      </div>
      {open !== null && <Lightbox items={items} index={open} onIndex={setOpen} onClose={() => setOpen(null)} />}
    </>
  )
}
