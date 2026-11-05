'use client'

import { useEffect, useState } from 'react'

// Closing statements, one at a time with dots: the reference's slider.
// Auto-advances every 6 s (paused on hover/focus, off with reduced motion).
export function NotesSlider({ notes }: { notes: string[] }) {
  const [i, setI] = useState(0)
  const [paused, setPaused] = useState(false)
  useEffect(() => {
    if (paused || notes.length < 2 || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
    const t = setInterval(() => setI((n) => (n + 1) % notes.length), 6000)
    return () => clearInterval(t)
  }, [paused, notes.length])
  return (
    <div onMouseEnter={() => setPaused(true)} onMouseLeave={() => setPaused(false)} onFocus={() => setPaused(true)} onBlur={() => setPaused(false)}>
      <div className="grid">
        {notes.map((n, k) => (
          <p
            key={n}
            aria-hidden={k !== i}
            className={`col-start-1 row-start-1 mx-auto max-w-[30ch] text-center font-display text-[clamp(1.25rem,2.6vw,2.25rem)] leading-[1.4] text-fg transition-opacity duration-700 ${k === i ? 'opacity-100' : 'pointer-events-none opacity-0'}`}
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
