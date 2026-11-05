'use client'

import { useEffect, useRef, useState } from 'react'

// Closing statements, one at a time with arrows and dots: the reference's slider.
// Auto-advances every 6 s while on screen (paused on hover/focus, off with reduced motion).
export function NotesSlider({ notes }: { notes: string[] }) {
  const [i, setI] = useState(0)
  const [paused, setPaused] = useState(false)
  const [onScreen, setOnScreen] = useState(false)
  const box = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const el = box.current
    if (!el || !('IntersectionObserver' in window)) return
    const io = new IntersectionObserver(([e]) => setOnScreen(e.isIntersecting))
    io.observe(el)
    return () => io.disconnect()
  }, [])
  useEffect(() => {
    if (paused || !onScreen || notes.length < 2 || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
    const t = setInterval(() => setI((n) => (n + 1) % notes.length), 6000)
    return () => clearInterval(t)
  }, [paused, onScreen, notes.length])
  return (
    <div ref={box} onMouseEnter={() => setPaused(true)} onMouseLeave={() => setPaused(false)} onFocus={() => setPaused(true)} onBlur={() => setPaused(false)}>
      <div className="relative grid px-10 md:px-16">
        {notes.length > 1 && (
          <>
            <button type="button" onClick={() => setI((n) => (n - 1 + notes.length) % notes.length)} aria-label="Előző" className="absolute left-0 top-1/2 z-10 flex h-11 w-11 -translate-y-1/2 items-center justify-center text-fg/60 transition-colors hover:text-fg">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="m15 18-6-6 6-6" /></svg>
            </button>
            <button type="button" onClick={() => setI((n) => (n + 1) % notes.length)} aria-label="Következő" className="absolute right-0 top-1/2 z-10 flex h-11 w-11 -translate-y-1/2 items-center justify-center text-fg/60 transition-colors hover:text-fg">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="m9 18 6-6-6-6" /></svg>
            </button>
          </>
        )}
        {notes.map((n, k) => (
          <p
            key={n}
            aria-hidden={k !== i}
            className={`col-start-1 row-start-1 mx-auto max-w-[30ch] text-center font-display text-[clamp(1.25rem,2.6vw,2.25rem)] leading-[1.4] text-fg transition-[opacity,transform] duration-700 ease-[cubic-bezier(0.22,1,0.36,1)] ${k === i ? 'translate-y-0 opacity-100' : 'pointer-events-none translate-y-2 opacity-0'}`}
          >
            {n}
          </p>
        ))}
      </div>
      {notes.length > 1 && (
        <div className="mt-6 flex justify-center gap-1" role="group" aria-label="Tudnivalók lapozása">
          {notes.map((n, k) => (
            <button key={n} type="button" onClick={() => setI(k)} aria-label={`${k + 1}. tudnivaló`} aria-current={k === i} className="flex h-8 w-8 items-center justify-center">
              <span className={`block h-[7px] w-[7px] rounded-full transition-colors ${k === i ? 'bg-fg' : 'bg-fg/30'}`} />
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
