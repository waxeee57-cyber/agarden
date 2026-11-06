'use client'

import { useRef, useState } from 'react'
import Image from 'next/image'
import { Lightbox, type LightboxItem } from './Lightbox'

// Photo slider for one space of the house (the reference's per-room gallery
// slider): arrows, dots, swipe, counter; a tap enlarges in the lightbox.
export function SpaceSlider({ items, label }: { items: LightboxItem[]; label: string }) {
  const [i, setI] = useState(0)
  const [open, setOpen] = useState<number | null>(null)
  const touch = useRef<number | null>(null)
  const n = items.length
  if (!n) return null
  const go = (d: number) => setI((k) => (k + d + n) % n)
  return (
    <div className="group/slider relative" role="group" aria-roledescription="képlapozó" aria-label={label}>
      <div
        className="relative aspect-[4/3] overflow-hidden rounded-2xl bg-surface-2"
        onTouchStart={(e) => { touch.current = e.touches[0].clientX }}
        onTouchEnd={(e) => {
          const s = touch.current; touch.current = null
          if (s == null) return
          const dx = e.changedTouches[0].clientX - s
          if (Math.abs(dx) > 40) go(dx < 0 ? 1 : -1)
        }}
      >
        {items.map((p, k) => (
          <button
            key={p.id}
            type="button"
            tabIndex={k === i ? 0 : -1}
            aria-hidden={k !== i}
            onClick={() => setOpen(k)}
            aria-label={`${p.alt || 'Fotó'}, nagyítás`}
            className={`zoom-tile absolute inset-0 cursor-zoom-in transition-opacity duration-500 ${k === i ? 'opacity-100' : 'pointer-events-none opacity-0'}`}
          >
            {Math.abs(k - i) <= 1 || (i === 0 && k === n - 1) || (i === n - 1 && k === 0)
              ? <Image src={p.url} alt={p.alt} fill sizes="(min-width: 768px) 560px, 100vw" className="object-cover" quality={85} />
              : null}
          </button>
        ))}
        {n > 1 && (
          <>
            <button type="button" onClick={() => go(-1)} aria-label="Előző fotó" className="absolute left-3 top-1/2 z-10 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full bg-white/90 text-fg shadow transition-opacity md:opacity-0 md:group-hover/slider:opacity-100 md:focus-visible:opacity-100">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="m15 18-6-6 6-6" /></svg>
            </button>
            <button type="button" onClick={() => go(1)} aria-label="Következő fotó" className="absolute right-3 top-1/2 z-10 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full bg-white/90 text-fg shadow transition-opacity md:opacity-0 md:group-hover/slider:opacity-100 md:focus-visible:opacity-100">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="m9 18 6-6-6-6" /></svg>
            </button>
            <span className="pointer-events-none absolute bottom-3 right-3 z-10 rounded-full bg-black/55 px-2.5 py-1 text-xs font-semibold tnum text-white">{i + 1} / {n}</span>
          </>
        )}
      </div>
      {n > 1 && (
        <div className="mt-3 flex flex-wrap justify-center gap-0.5" aria-label="Fotók">
          {items.map((p, k) => (
            <button key={p.id} type="button" onClick={() => setI(k)} aria-label={`${k + 1}. fotó`} aria-current={k === i} className="flex h-6 w-6 items-center justify-center">
              <span className={`block h-[7px] w-[7px] rounded-full transition-colors ${k === i ? 'bg-fg' : 'bg-fg/25'}`} />
            </button>
          ))}
        </div>
      )}
      {open !== null && <Lightbox items={items} index={open} onIndex={setOpen} onClose={() => setOpen(null)} />}
    </div>
  )
}
