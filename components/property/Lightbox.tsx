'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import Image from 'next/image'
import { createPortal } from 'react-dom'

export type LightboxItem = { id: string; url: string; width: number; height: number; alt: string }

// Full-screen photo viewer shared by the homepage strip and the gallery.
// Keyboard (← → Esc), swipe on touch, focus returns to the opener on close,
// page scroll locked while open. Neighbouring photos are preloaded.
export function Lightbox({ items, index, onIndex, onClose }: {
  items: LightboxItem[]
  index: number
  onIndex: (i: number) => void
  onClose: () => void
}) {
  const len = items.length
  const item = items[index]
  const touch = useRef<{ x: number; y: number } | null>(null)
  const closeBtn = useRef<HTMLButtonElement>(null)
  const [loaded, setLoaded] = useState<string | null>(null)

  const go = useCallback((d: number) => onIndex((index + d + len) % len), [index, len, onIndex])

  useEffect(() => {
    const opener = document.activeElement as HTMLElement | null
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
      else if (e.key === 'ArrowRight') go(1)
      else if (e.key === 'ArrowLeft') go(-1)
    }
    window.addEventListener('keydown', onKey)
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    closeBtn.current?.focus()
    return () => {
      window.removeEventListener('keydown', onKey)
      document.body.style.overflow = prev
      opener?.focus?.()
    }
  }, [go, onClose])

  if (!item) return null
  const ratio = item.width / item.height

  // portal: sections use content-visibility (contain: paint), which would
  // otherwise trap position:fixed inside the section box
  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-label={`Fotó ${index + 1} / ${len}`}
      className="lb-in fixed inset-0 z-[60] flex flex-col bg-[rgb(10_12_11/0.96)] text-[#F4F4F1]"
      onClick={onClose}
      onTouchStart={(e) => { touch.current = { x: e.touches[0].clientX, y: e.touches[0].clientY } }}
      onTouchEnd={(e) => {
        const t = touch.current
        touch.current = null
        if (!t) return
        const dx = e.changedTouches[0].clientX - t.x
        const dy = e.changedTouches[0].clientY - t.y
        if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy)) go(dx < 0 ? 1 : -1)
        else if (dy > 90 && Math.abs(dy) > Math.abs(dx)) onClose()
      }}
    >
      <div className="flex items-center justify-between px-4 py-3 md:px-6" onClick={(e) => e.stopPropagation()}>
        <span className="text-[0.78rem] font-semibold tracking-[0.14em] tnum text-[#F4F4F1]/80">{index + 1} / {len}</span>
        <button ref={closeBtn} type="button" onClick={onClose} aria-label="Bezárás" className="lb-btn">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6 6 18" /></svg>
        </button>
      </div>

      <div className="relative flex min-h-0 flex-1 items-center justify-center px-2 md:px-20">
        <div
          key={item.id}
          className={`lb-img relative max-h-full w-full ${loaded === item.id ? 'is-loaded' : ''}`}
          style={{ aspectRatio: String(ratio), maxWidth: `min(100%, calc((100svh - 150px) * ${ratio}))` }}
          onClick={(e) => e.stopPropagation()}
        >
          <Image src={item.url} alt={item.alt} fill sizes="100vw" quality={85} priority onLoad={() => setLoaded(item.id)} className="rounded-[6px] object-contain" />
        </div>
        {len > 1 && (
          <>
            <button type="button" onClick={(e) => { e.stopPropagation(); go(-1) }} aria-label="Előző fotó" className="lb-btn absolute left-3 top-1/2 hidden -translate-y-1/2 md:flex">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="m15 18-6-6 6-6" /></svg>
            </button>
            <button type="button" onClick={(e) => { e.stopPropagation(); go(1) }} aria-label="Következő fotó" className="lb-btn absolute right-3 top-1/2 hidden -translate-y-1/2 md:flex">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="m9 18 6-6-6-6" /></svg>
            </button>
          </>
        )}
      </div>

      <div className="px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-3 text-center" onClick={(e) => e.stopPropagation()}>
        {item.alt && <p className="mx-auto max-w-[60ch] text-sm text-[#F4F4F1]/85">{item.alt}</p>}
        {len > 1 && <p className="mt-1 text-xs text-[#F4F4F1]/50 md:hidden">Lapozás: húzza oldalra a képet</p>}
      </div>

      {/* preload neighbours so paging is instant */}
      <div className="hidden" aria-hidden="true">
        {[items[(index + 1) % len], items[(index - 1 + len) % len]].map((p) => p && p.id !== item.id && (
          <Image key={p.id} src={p.url} alt="" width={p.width} height={p.height} sizes="100vw" quality={85} loading="eager" />
        ))}
      </div>
    </div>,
    document.body,
  )
}
