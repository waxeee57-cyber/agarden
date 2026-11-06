'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { fmtDay, parseISO } from './Calendar'

// Hero booking bar (the big stay sites' "Check-in | Check-out | Guests").
// Dates are picked in the live calendar below (#foglaltsag); once picked
// there, this bar shows them too and the button carries them to the form.
export const RANGE_EVENT = 'agarden:range'
export type RangeDetail = { ci: string | null; co: string | null }

export function HeroBookingBar({ capacity }: { capacity: string | null }) {
  const [r, setR] = useState<RangeDetail>({ ci: null, co: null })
  useEffect(() => {
    const on = (e: Event) => setR((e as CustomEvent<RangeDetail>).detail)
    window.addEventListener(RANGE_EVENT, on)
    return () => window.removeEventListener(RANGE_EVENT, on)
  }, [])
  const href = r.ci && r.co ? `/foglalas?checkIn=${r.ci}&checkOut=${r.co}` : '/foglalas'
  return (
    <div className="mx-auto mt-8 grid max-w-3xl overflow-hidden rounded-[var(--radius-md)] bg-white text-left text-fg shadow-[0_24px_60px_-30px_rgb(0_0_0/0.6)] sm:grid-cols-[1fr_auto] md:mt-11">
      <a href="#foglaltsag" aria-label="Időpont kiválasztása a foglaltsági naptárban" className="group grid grid-cols-2 divide-x divide-rule hover:bg-black/[0.025] md:grid-cols-3">
        <Field label="Érkezés" value={r.ci ? fmtDay(parseISO(r.ci)) : null} />
        <Field label="Távozás" value={r.co ? fmtDay(parseISO(r.co)) : null} />
        {capacity && <span className="hidden md:block"><Field label="Létszám" value={capacity} /></span>}
      </a>
      <Link href={href} className="btn btn-act !min-h-[64px] rounded-none">Foglalás</Link>
    </div>
  )
}

function Field({ label, value }: { label: string; value: string | null }) {
  return (
    <span className="block px-5 py-3.5">
      <span className="block font-ui text-[11px] font-bold uppercase tracking-[0.16em] text-soft">{label}</span>
      <span className="mt-0.5 block truncate text-[15px] font-semibold text-fg group-hover:underline group-hover:underline-offset-4">
        {value ?? <><span className="md:hidden">Válasszon</span><span className="hidden md:inline">Dátum kiválasztása</span></>}
      </span>
    </span>
  )
}
