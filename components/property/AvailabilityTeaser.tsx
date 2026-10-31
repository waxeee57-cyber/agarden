'use client'

import { useEffect, useRef, useState } from 'react'
import dynamic from 'next/dynamic'
import Link from 'next/link'
import { fmtDay, parseISO } from './Calendar'

// Homepage "Foglaltság": the live calendar, loaded only when it scrolls near
// (keeps it off the first paint). Picking dates hands them to the wizard.
const Calendar = dynamic(() => import('./Calendar').then((m) => m.Calendar), {
  ssr: false,
  loading: () => <div className="h-[380px] animate-pulse rounded-[var(--radius-lg)] bg-surface-2" aria-hidden="true" />,
})

export function AvailabilityTeaser({ phone, email }: { phone: string; email: string | null }) {
  const ref = useRef<HTMLDivElement>(null)
  const [near, setNear] = useState(false)
  const [range, setRange] = useState<{ ci: string | null; co: string | null }>({ ci: null, co: null })

  useEffect(() => {
    const el = ref.current
    if (!el) return
    const io = new IntersectionObserver((e) => { if (e.some((x) => x.isIntersecting)) { setNear(true); io.disconnect() } }, { rootMargin: '400px' })
    io.observe(el)
    return () => io.disconnect()
  }, [])

  const href = range.ci && range.co ? `/foglalas?checkIn=${range.ci}&checkOut=${range.co}` : '/foglalas'
  return (
    <div ref={ref}>
      {near ? (
        <Calendar checkIn={range.ci} checkOut={range.co} contact={{ phone, email }} onSelect={(ci, co) => setRange({ ci, co })} />
      ) : (
        <div className="h-[380px] rounded-[var(--radius-lg)] bg-surface-2" aria-hidden="true" />
      )}
      <div className="mt-5 flex flex-wrap items-center gap-4">
        <Link href={href} className="btn btn-act">
          {range.ci && range.co ? `Foglalás: ${fmtDay(parseISO(range.ci))} – ${fmtDay(parseISO(range.co))}` : 'Foglalás'}
        </Link>
        <p className="text-sm text-soft">{range.ci && range.co ? 'A dátumokat a foglalásnál már nem kell újra megadnod.' : 'Koppints az érkezés, majd a távozás napjára.'}</p>
      </div>
    </div>
  )
}
