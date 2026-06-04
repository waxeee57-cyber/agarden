'use client'

import { useEffect, useState } from 'react'

export type GalleryItem = { id: string; src: string; label: string }

// Masonry gallery driven entirely by the photos that actually exist. Every tile
// is a real photo and opens in a lightbox — no placeholder tiles.
export function Gallery({ items }: { items: GalleryItem[] }) {
  const photos = items
  const [open, setOpen] = useState<number | null>(null)

  // Plain handlers (React Compiler memoizes; no manual useCallback).
  const close = () => setOpen(null)
  const step = (d: number) => setOpen((i) => (i === null ? i : (i + d + photos.length) % photos.length))

  useEffect(() => {
    if (open === null) return
    const len = photos.length
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(null)
      else if (e.key === 'ArrowRight') setOpen((i) => (i === null ? i : (i + 1 + len) % len))
      else if (e.key === 'ArrowLeft') setOpen((i) => (i === null ? i : (i - 1 + len) % len))
    }
    window.addEventListener('keydown', onKey)
    document.body.style.overflow = 'hidden'
    return () => {
      window.removeEventListener('keydown', onKey)
      document.body.style.overflow = ''
    }
  }, [open, photos.length])

  return (
    <>
      <div className="[column-fill:_balance] columns-2 md:columns-3 gap-3 md:gap-4">
        {items.map((item, idx) => (
          <button
            key={item.id}
            onClick={() => setOpen(idx)}
            className="group mb-3 md:mb-4 block w-full overflow-hidden rounded-[var(--radius-lg)] border border-line"
            aria-label={`${item.label} — nagyítás`}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={item.src}
              alt={item.label}
              loading="lazy"
              className="w-full h-auto object-cover transition-transform duration-500 group-hover:scale-[1.04]"
            />
          </button>
        ))}
      </div>

      {open !== null && photos[open]?.src && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={photos[open].label}
          className="fixed inset-0 z-50 flex items-center justify-center bg-ink/90 p-4"
          onClick={close}
        >
          <button onClick={close} aria-label="Bezárás" className="absolute top-4 right-4 text-cream/80 hover:text-cream text-3xl leading-none">×</button>
          <button
            onClick={(e) => { e.stopPropagation(); step(-1) }}
            aria-label="Előző"
            className="absolute left-3 md:left-8 text-cream/70 hover:text-cream text-4xl leading-none px-2"
          >‹</button>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={photos[open].src}
            alt={photos[open].label}
            onClick={(e) => e.stopPropagation()}
            className="max-h-[86vh] max-w-[92vw] object-contain rounded-[var(--radius-md)] shadow-2xl"
          />
          <button
            onClick={(e) => { e.stopPropagation(); step(1) }}
            aria-label="Következő"
            className="absolute right-3 md:right-8 text-cream/70 hover:text-cream text-4xl leading-none px-2"
          >›</button>
          <span className="absolute bottom-5 left-0 right-0 text-center text-cream/80 text-sm">
            {photos[open].label} · {open + 1}/{photos.length}
          </span>
        </div>
      )}
    </>
  )
}
