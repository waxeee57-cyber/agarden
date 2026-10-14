'use client'

import { useEffect, useState } from 'react'
import { telHref } from '@/lib/brand'

// Mobile-only sticky booking bar (pattern from costasol MobileStickyCTA).
// Hides itself while the booking section is on screen so it never covers the form.
export function MobileStickyCTA({ phone }: { phone: string }) {
  const [hidden, setHidden] = useState(false)

  useEffect(() => {
    const target = document.getElementById('foglalas')
    if (!target) return
    const io = new IntersectionObserver((entries) => setHidden(entries.some((e) => e.isIntersecting)), { threshold: 0.05 })
    io.observe(target)
    return () => io.disconnect()
  }, [])

  return (
    <div
      className={`fixed inset-x-0 bottom-0 z-40 border-t border-rule bg-bg/95 backdrop-blur transition-transform duration-300 md:hidden ${hidden ? 'translate-y-full' : ''}`}
      style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
      aria-hidden={hidden || undefined}
    >
      <div className="flex gap-3 px-4 py-3">
        <a href="#foglalas" className="btn btn-act flex-1" tabIndex={hidden ? -1 : 0}>Foglalás, ajánlatkérés</a>
        <a href={telHref(phone)} className="btn btn-line !w-12 !px-0" aria-label={`Hívás: ${phone}`} tabIndex={hidden ? -1 : 0}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.1 4.2 2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1.9.4 1.8.7 2.7a2 2 0 0 1-.5 2.1L8 9.8a16 16 0 0 0 6 6l1.3-1.3a2 2 0 0 1 2.1-.4c.9.3 1.8.6 2.7.7a2 2 0 0 1 1.7 2z" />
          </svg>
        </a>
      </div>
    </div>
  )
}
