'use client'

import { useEffect, useState } from 'react'
import Image from 'next/image'

export type GalleryItem = { id: string; url: string; width: number; height: number; alt: string }

// Masonry gallery of the house's real photos (listing_photos). Every tile
// opens a keyboard-navigable lightbox. No placeholder tiles, ever.
export function Gallery({ items }: { items: GalleryItem[] }) {
  const [open, setOpen] = useState<number | null>(null)
  const len = items.length
  const close = () => setOpen(null)
  const step = (d: number) => setOpen((i) => (i === null ? i : (i + d + len) % len))

  useEffect(() => {
    if (open === null) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(null)
      else if (e.key === 'ArrowRight') setOpen((i) => (i === null ? i : (i + 1) % len))
      else if (e.key === 'ArrowLeft') setOpen((i) => (i === null ? i : (i - 1 + len) % len))
    }
    window.addEventListener('keydown', onKey)
    document.body.style.overflow = 'hidden'
    return () => { window.removeEventListener('keydown', onKey); document.body.style.overflow = '' }
  }, [open, len])

  const current = open === null ? null : items[open]

  return (
    <>
      <div className="columns-2 gap-3 md:columns-3 md:gap-4">
        {items.map((item, idx) => (
          <button
            key={item.id}
            type="button"
            onClick={() => setOpen(idx)}
            className="group mb-3 block w-full overflow-hidden rounded-[var(--radius-lg)] border border-rule md:mb-4"
            aria-label={`${item.alt || 'Fotó'}, nagyítás`}
          >
            <Image
              src={item.url}
              alt={item.alt}
              width={item.width}
              height={item.height}
              sizes="(min-width: 768px) 33vw, 50vw"
              className="h-auto w-full transition-transform duration-500 group-hover:scale-[1.03]"
            />
          </button>
        ))}
      </div>

      {current && (
        <div role="dialog" aria-modal="true" aria-label={current.alt || 'Fotó'} className="fixed inset-0 z-50 flex items-center justify-center bg-[rgb(6_10_9/0.93)] p-4" onClick={close}>
          <button type="button" onClick={close} aria-label="Bezárás" autoFocus className="absolute right-3 top-3 flex h-12 w-12 items-center justify-center text-3xl leading-none text-[#F4EFE6]/85 hover:text-[#F4EFE6]">×</button>
          <button type="button" onClick={(e) => { e.stopPropagation(); step(-1) }} aria-label="Előző fotó" className="absolute left-1 flex h-12 w-12 items-center justify-center text-4xl leading-none text-[#F4EFE6]/80 hover:text-[#F4EFE6] md:left-6">‹</button>
          <Image
            src={current.url}
            alt={current.alt}
            width={current.width}
            height={current.height}
            sizes="92vw"
            onClick={(e) => e.stopPropagation()}
            className="max-h-[84vh] w-auto max-w-[92vw] rounded-[var(--radius-md)] object-contain shadow-2xl"
          />
          <button type="button" onClick={(e) => { e.stopPropagation(); step(1) }} aria-label="Következő fotó" className="absolute right-1 flex h-12 w-12 items-center justify-center text-4xl leading-none text-[#F4EFE6]/80 hover:text-[#F4EFE6] md:right-6">›</button>
          <span className="absolute bottom-4 left-0 right-0 px-6 text-center text-sm text-[#F4EFE6]/85">
            {current.alt} · {open! + 1}/{len}
          </span>
        </div>
      )}
    </>
  )
}
