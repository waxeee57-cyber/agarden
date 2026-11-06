'use client'

import { useEffect, useMemo, useState } from 'react'
import { telHref } from '@/lib/brand'

// ---- tiny local date helpers (no dep) ----
const pad = (n: number) => String(n).padStart(2, '0')
export const toISO = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
export const parseISO = (s: string) => { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d) }
export const addDays = (d: Date, n: number) => { const x = new Date(d); x.setDate(x.getDate() + n); return x }
const addMonths = (d: Date, n: number) => new Date(d.getFullYear(), d.getMonth() + n, 1)
const startOfMonth = (d: Date) => new Date(d.getFullYear(), d.getMonth(), 1)
const sameDay = (a: Date, b: Date) => toISO(a) === toISO(b)
const wd = (d: Date) => (d.getDay() + 6) % 7 // Monday-first

export const MONTHS = ['január', 'február', 'március', 'április', 'május', 'június', 'július', 'augusztus', 'szeptember', 'október', 'november', 'december']
const DOW = ['H', 'K', 'Sze', 'Cs', 'P', 'Szo', 'V']
export const fmtDay = (d: Date) => `${MONTHS[d.getMonth()]} ${d.getDate()}.`
/** A stay in Hungarian notation (AkH 12): same month "március 6–9.",
 *  across months "március 30. – április 2.", across years with the years. */
export const fmtRange = (a: Date, b: Date) =>
  a.getFullYear() !== b.getFullYear()
    ? `${a.getFullYear()}. ${fmtDay(a)} – ${b.getFullYear()}. ${fmtDay(b)}`
    : a.getMonth() === b.getMonth()
      ? `${MONTHS[a.getMonth()]} ${a.getDate()}–${b.getDate()}.`
      : `${fmtDay(a)} – ${fmtDay(b)}`
export const fmtRangeISO = (a: string, b: string) => fmtRange(parseISO(a), parseISO(b))
const MONTHS_SHORT = ['jan.', 'febr.', 'márc.', 'ápr.', 'máj.', 'jún.', 'júl.', 'aug.', 'szept.', 'okt.', 'nov.', 'dec.']
/** Compact day for tight spots (the phone booking bar): "nov. 13." */
export const fmtShort = (d: Date) => `${MONTHS_SHORT[d.getMonth()]} ${d.getDate()}.`

type Range = { from: string; to: string; kind: string }
type DayMeta = { isPast: boolean; isOccupied: boolean; isStart: boolean; isEnd: boolean; inRange: boolean; selectable: boolean; hasRange: boolean }
type LoadState = 'loading' | 'ready' | 'error'

export function Calendar({
  checkIn,
  checkOut,
  onSelect,
  onBlockedPick,
  contact,
  minNights,
  summary = true,
}: {
  checkIn: string | null
  checkOut: string | null
  onSelect: (checkIn: string | null, checkOut: string | null) => void
  /** A booked day was clicked — lets the widget suggest the sister house. */
  onBlockedPick?: (dayIso: string) => void
  contact: { phone: string; email: string | null }
  /** shown in the hint while the departure is being chosen */
  minNights?: number
  /** false: the parent shows its own selection summary (home teaser) */
  summary?: boolean
}) {
  const today = useMemo(() => parseISO(toISO(new Date())), [])
  const [view, setView] = useState<Date>(() => startOfMonth(new Date()))
  const [occupied, setOccupied] = useState<Set<string>>(new Set())
  const [state, setState] = useState<LoadState>('loading')
  const [attempt, setAttempt] = useState(0)
  const [hover, setHover] = useState<Date | null>(null)

  useEffect(() => {
    // All setState happens in promise callbacks (never synchronously here).
    const ctrl = new AbortController()
    const timer = setTimeout(() => ctrl.abort(), 10_000)
    const from = toISO(today)
    const to = toISO(addDays(today, 400))
    fetch(`/api/availability?from=${from}&to=${to}`, { signal: ctrl.signal, cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
      .then((data: { ok?: boolean; ranges?: Range[] }) => {
        if (!data.ok) throw new Error('not ok')
        const set = new Set<string>()
        for (const r of data.ranges ?? []) {
          let d = parseISO(r.from)
          const end = parseISO(r.to) // exclusive
          while (d < end) { set.add(toISO(d)); d = addDays(d, 1) }
        }
        setOccupied(set)
        setState('ready')
      })
      .catch(() => setState('error'))
      .finally(() => clearTimeout(timer))
    return () => { clearTimeout(timer); ctrl.abort() }
  }, [today, attempt])

  const ci = checkIn ? parseISO(checkIn) : null
  const co = checkOut ? parseISO(checkOut) : null

  const spanFree = (a: Date, b: Date) => {
    let d = new Date(a)
    while (d < b) { if (occupied.has(toISO(d))) return false; d = addDays(d, 1) }
    return true
  }
  const firstBookedAfter = (a: Date): Date | null => {
    for (let i = 1; i <= 400; i++) { const d = addDays(a, i); if (occupied.has(toISO(d))) return d }
    return null
  }

  const previewEnd: Date | null = co ?? (ci && hover && hover > ci && spanFree(ci, hover) ? hover : null)

  function clickDay(day: Date, m: DayMeta) {
    const iso = toISO(day)
    if (!m.selectable) {
      if (m.isOccupied && !m.isPast) onBlockedPick?.(iso)
      return
    }
    if (!ci || (ci && co)) { setHover(null); onSelect(iso, null); return }
    if (sameDay(day, ci)) { setHover(null); onSelect(null, null); return }
    if (day < ci) { onSelect(iso, null); return }
    if (spanFree(ci, day)) { onSelect(checkIn, iso); return }
    onSelect(iso, null)
  }

  function dayMeta(day: Date): DayMeta {
    const iso = toISO(day)
    const isPast = day < today
    const isOccupied = occupied.has(iso)
    const isStart = !!ci && sameDay(day, ci)
    const isEnd = !!previewEnd && sameDay(day, previewEnd)
    const inRange = !!ci && !!previewEnd && day > ci && day < previewEnd
    const selectable = ci && !co && day > ci ? spanFree(ci, day) : !isPast && !isOccupied
    return { isPast, isOccupied, isStart, isEnd, inRange, selectable, hasRange: !!ci && !!previewEnd }
  }

  const canPrev = startOfMonth(today) < view
  const choosingEnd = !!ci && !co
  const cap = ci ? firstBookedAfter(ci) : null
  const guidance = !choosingEnd
    ? null
    : cap
      ? `Most a távozás napját válassza ki; legkésőbb ${fmtDay(cap)}, utána már foglalt a ház.`
      : `Most a távozás napját válassza ki${minNights && minNights > 1 ? ` (legalább ${minNights} éjszaka)` : ''}.`

  const nights = ci && co ? Math.round((co.getTime() - ci.getTime()) / 86_400_000) : 0
  const arrow = 'flex h-10 w-10 items-center justify-center rounded-full text-fg transition-colors hover:bg-surface-2 disabled:cursor-not-allowed disabled:opacity-30'

  return (
    <div>
      {state === 'error' && (
        <div role="alert" className="mb-4 rounded-[var(--radius-md)] border border-bad/30 bg-bad/5 px-4 py-3 text-sm">
          <p className="font-semibold text-bad">A foglaltságot most nem sikerült betölteni.</p>
          <p className="mt-1 text-fg/85">
            Kérjük, hívjon minket: <a className="font-semibold underline underline-offset-2" href={telHref(contact.phone)}>{contact.phone}</a>
            {contact.email && <> · <a className="font-semibold underline underline-offset-2" href={`mailto:${contact.email}`}>{contact.email}</a></>}
          </p>
          <button type="button" className="mt-2 font-semibold text-pop underline underline-offset-2" onClick={() => { setState('loading'); setAttempt((n) => n + 1) }}>
            Újrapróbálom
          </button>
        </div>
      )}

      <div className="relative" onMouseLeave={() => setHover(null)} aria-busy={state === 'loading'}>
        <div className="absolute inset-x-0 top-0 z-10 flex justify-between">
          <button type="button" onClick={() => canPrev && setView(addMonths(view, -1))} disabled={!canPrev} aria-label="Előző hónap" className={arrow}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="m15 18-6-6 6-6" /></svg>
          </button>
          <button type="button" onClick={() => setView(addMonths(view, 1))} aria-label="Következő hónap" className={arrow}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="m9 18 6-6-6-6" /></svg>
          </button>
        </div>
        <div key={toISO(view)} className={`cal-in grid gap-x-10 gap-y-8 md:grid-cols-2 transition-opacity ${state === 'loading' ? 'opacity-60' : ''}`}>
          <MonthGrid month={view} today={today} dayMeta={dayMeta} onPick={clickDay} onHover={setHover} choosingEnd={choosingEnd} onBlockedPickable={!!onBlockedPick} />
          <div className="hidden md:block">
            <MonthGrid month={addMonths(view, 1)} today={today} dayMeta={dayMeta} onPick={clickDay} onHover={setHover} choosingEnd={choosingEnd} onBlockedPickable={!!onBlockedPick} />
          </div>
        </div>
      </div>

      {summary && (
        <div className="mt-5 flex min-h-11 flex-wrap items-center justify-between gap-x-4 gap-y-2 border-t border-rule pt-4 text-sm" aria-live="polite">
          <span className="text-fg/90">
            {ci && co ? <><span className="font-semibold">{fmtRange(ci, co)}</span><span className="text-soft"> · {nights} éjszaka</span></>
              : ci ? <><span className="font-semibold">Érkezés: {fmtDay(ci)}</span><span className="text-soft"> · {guidance}</span></>
              : <span className="text-soft">{state === 'loading' ? 'A foglaltság betöltése…' : 'Válassza ki az érkezés napját.'}</span>}
          </span>
          {(checkIn || checkOut) && (
            <button type="button" onClick={() => { setHover(null); onSelect(null, null) }} className="min-h-11 font-semibold underline underline-offset-4 hover:text-pop">
              Dátumok törlése
            </button>
          )}
        </div>
      )}
      <div className={`flex flex-wrap items-center gap-x-6 gap-y-2 text-[13px] text-soft ${summary ? 'mt-2' : 'mt-5 border-t border-rule pt-4'}`}>
        <Legend kind="free" label="szabad" />
        <Legend kind="taken" label={onBlockedPick ? 'foglalt (ha rákattint, megmutatjuk a testvérházat)' : 'foglalt'} />
        <Legend kind="sel" label="kiválasztott napok" />
      </div>
    </div>
  )
}

function Legend({ kind, label }: { kind: 'free' | 'taken' | 'sel'; label: string }) {
  const dot = kind === 'sel' ? 'bg-sel' : kind === 'taken' ? 'bg-taken' : 'bg-surface shadow-[inset_0_0_0_1.5px_var(--color-fg)]'
  return (
    <span className="inline-flex items-center gap-2">
      <span className={`relative inline-block h-4 w-4 shrink-0 rounded-full ${dot}`} aria-hidden="true">
        {kind === 'taken' && <span className="absolute inset-x-[3px] top-1/2 h-px -translate-y-1/2 bg-taken-fg" />}
      </span>
      {label}
    </span>
  )
}

function MonthGrid({
  month, today, dayMeta, onPick, onHover, choosingEnd, onBlockedPickable,
}: {
  month: Date
  today: Date
  dayMeta: (d: Date) => DayMeta
  onPick: (d: Date, m: DayMeta) => void
  onHover: (d: Date | null) => void
  choosingEnd: boolean
  onBlockedPickable: boolean
}) {
  const first = startOfMonth(month)
  const lead = wd(first)
  const daysInMonth = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate()
  const cells: (Date | null)[] = []
  for (let i = 0; i < lead; i++) cells.push(null)
  for (let d = 1; d <= daysInMonth; d++) cells.push(new Date(month.getFullYear(), month.getMonth(), d))

  return (
    <div>
      <p className="flex h-10 items-center justify-center font-display text-[1.3rem] text-fg">{month.getFullYear()}. {MONTHS[month.getMonth()]}</p>
      {/* Hungarian weekday abbreviations as written (H, K, Sze…), never upper-cased */}
      <div className="mt-4 grid grid-cols-7 text-center font-ui text-[12px] font-semibold text-soft" aria-hidden="true">
        {DOW.map((d, i) => <div key={d} className={`pb-2 ${i > 4 ? 'text-fg/70' : ''}`}>{d}</div>)}
      </div>
      <div className="grid grid-cols-7 gap-y-1">
        {cells.map((day, i) => {
          if (!day) return <div key={i} />
          const m = dayMeta(day)
          const edge = m.isStart || m.isEnd
          const both = m.isStart && m.isEnd
          // continuous range band behind the circles (half band on the edges,
          // none past a row's end: a Sunday start / Monday end has no neighbour)
          const col = wd(day)
          const band = m.inRange
            ? `bg-range ${col === 0 ? 'rounded-l-full' : ''} ${col === 6 ? 'rounded-r-full' : ''}`
            : m.isStart && !both && m.hasRange && col !== 6 ? 'bg-[linear-gradient(90deg,transparent_50%,var(--color-range)_50%)]'
            : m.isEnd && !both && col !== 0 ? 'bg-[linear-gradient(90deg,var(--color-range)_50%,transparent_50%)]' : ''
          let cls = 'relative mx-auto flex aspect-square w-full max-w-12 items-center justify-center rounded-full text-[0.98rem] tnum transition-[background-color,box-shadow,color] duration-150 '
          if (edge) cls += 'bg-sel font-semibold text-sel-fg shadow-[0_6px_16px_-8px_rgb(0_0_0/0.45)]'
          else if (m.inRange) cls += 'font-semibold text-fg hover:shadow-[inset_0_0_0_1.5px_var(--color-fg)]'
          else if (m.isOccupied && !m.isPast) cls += 'bg-taken text-taken-fg line-through decoration-1 ' + (onBlockedPickable ? 'cursor-pointer' : 'cursor-not-allowed')
          else if (!m.selectable) cls += 'cursor-not-allowed text-fg/25'
          else cls += 'font-semibold text-fg hover:shadow-[inset_0_0_0_1.5px_var(--color-fg)]'
          const isToday = sameDay(day, today)
          const label = `${day.getFullYear()}. ${MONTHS[day.getMonth()]} ${day.getDate()}.${m.isOccupied ? (onBlockedPickable ? ', foglalt; megmutatjuk a testvérházat' : ', foglalt') : !m.selectable ? ', nem választható' : ''}`
          return (
            <div key={i} className={`py-px ${band}`}>
              <button
                type="button"
                onClick={() => onPick(day, m)}
                onMouseEnter={() => choosingEnd && m.selectable && onHover(day)}
                disabled={m.isPast && !m.selectable}
                aria-disabled={(!m.selectable && !(m.isOccupied && !m.isPast)) || undefined}
                aria-pressed={edge}
                aria-label={label}
                className={cls}
              >
                {day.getDate()}
                {isToday && !edge && <span aria-hidden="true" className="absolute bottom-1.5 h-1 w-1 rounded-full bg-current opacity-60" />}
              </button>
            </div>
          )
        })}
      </div>
    </div>
  )
}

