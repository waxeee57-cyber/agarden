'use client'

import { useEffect, useRef, useState } from 'react'
import dynamic from 'next/dynamic'
import Link from 'next/link'
import { fmtDay, fmtRange, parseISO } from './Calendar'

// Homepage "Foglaltság", laid out like the big booking sites: the live
// calendar on the right, and on the left one selection card that always says
// what is picked and what comes next (Érkezés / Távozás slots, nights, one
// button). The calendar loads only when it scrolls near (off the first paint).
const Calendar = dynamic(() => import('./Calendar').then((m) => m.Calendar), {
  ssr: false,
  loading: () => <div className="h-[420px] animate-pulse rounded-[var(--radius-lg)] bg-surface-2" aria-hidden="true" />,
})

export function AvailabilityTeaser({ phone, email, minNights, intro, facts }: {
  phone: string
  email: string | null
  minNights: number
  intro: React.ReactNode
  facts: React.ReactNode
}) {
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

  const ci = range.ci ? parseISO(range.ci) : null
  const co = range.co ? parseISO(range.co) : null
  const nights = ci && co ? Math.round((co.getTime() - ci.getTime()) / 86_400_000) : 0
  const href = range.ci && range.co ? `/foglalas?checkIn=${range.ci}&checkOut=${range.co}` : '/foglalas'
  const status = ci && co
    ? <><strong className="text-fg">{fmtRange(ci, co)}</strong> · {nights} éjszaka</>
    : ci
      ? <>Most a távozás napját válassza ki{minNights > 1 ? ` (legalább ${minNights} éjszaka)` : ''}.</>
      : <>Válassza ki a naptárban az érkezés napját.</>

  return (
    // Phone order: intro, calendar, selection card, facts. Desktop: the
    // calendar spans the right column next to all three.
    <div ref={ref} className="grid gap-x-16 gap-y-8 lg:grid-cols-[0.85fr_1.5fr] lg:grid-rows-[auto_auto_1fr]">
      <div className="lg:col-start-1 lg:row-start-1">{intro}</div>
      <div className="min-w-0 lg:col-start-2 lg:row-span-3 lg:row-start-1">
        {near ? (
          <Calendar checkIn={range.ci} checkOut={range.co} contact={{ phone, email }} minNights={minNights} summary={false} onSelect={(a, b) => setRange({ ci: a, co: b })} />
        ) : (
          <div className="h-[420px] rounded-[var(--radius-lg)] bg-surface-2" aria-hidden="true" />
        )}
      </div>
      <div className="lg:col-start-1 lg:row-start-2">
        <div className="rounded-[var(--radius-lg)] border border-rule bg-surface p-5 shadow-[0_18px_40px_-28px_rgb(0_0_0/0.35)]">
          <div className="grid grid-cols-2 overflow-hidden rounded-[var(--radius-md)] border border-rule">
            <Slot label="Érkezés" value={ci ? fmtDay(ci) : null} active={!ci} />
            <Slot label="Távozás" value={co ? fmtDay(co) : null} active={!!ci && !co} border />
          </div>
          <p className="mt-4 min-h-[3.2em] text-[15px] leading-[1.6] text-soft" aria-live="polite">{status}</p>
          <Link href={href} className="btn btn-act mt-2 w-full">{ci && co ? 'Tovább a foglaláshoz' : 'Foglalás'}</Link>
          <p className="mt-3 flex min-h-6 justify-between gap-3 text-[13px] text-soft">
            <span>{ci && co ? 'A dátumokat nem kell újra megadnia.' : 'Előleget nem kérünk, fizetés a helyszínen.'}</span>
            {ci && <button type="button" onClick={() => setRange({ ci: null, co: null })} className="font-semibold text-fg underline underline-offset-4 hover:text-pop">Törlés</button>}
          </p>
        </div>
      </div>
      <div className="lg:col-start-1 lg:row-start-3">{facts}</div>
    </div>
  )
}

function Slot({ label, value, active, border }: { label: string; value: string | null; active: boolean; border?: boolean }) {
  return (
    <div className={`px-4 py-3 ${border ? 'border-l border-rule' : ''} ${active ? 'shadow-[inset_0_-2px_0_var(--color-sel)]' : ''}`}>
      <p className="font-ui text-[11px] font-bold uppercase tracking-[0.16em] text-soft">{label}</p>
      <p className={`mt-1 whitespace-nowrap text-[1.02rem] ${value ? 'font-semibold text-fg' : 'text-soft'}`}>{value ?? 'Válasszon'}</p>
    </div>
  )
}
