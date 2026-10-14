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

type Range = { from: string; to: string; kind: string }
type DayMeta = { isPast: boolean; isOccupied: boolean; isStart: boolean; isEnd: boolean; inRange: boolean; selectable: boolean }
type LoadState = 'loading' | 'ready' | 'error'

export function Calendar({
  checkIn,
  checkOut,
  onSelect,
  onBlockedPick,
  contact,
}: {
  checkIn: string | null
  checkOut: string | null
  onSelect: (checkIn: string | null, checkOut: string | null) => void
  /** A booked day was clicked — lets the widget suggest the sister house. */
  onBlockedPick?: (dayIso: string) => void
  contact: { phone: string; email: string | null }
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
    return { isPast, isOccupied, isStart, isEnd, inRange, selectable }
  }

  const canPrev = startOfMonth(today) < view
  const choosingEnd = !!ci && !co
  const cap = ci ? firstBookedAfter(ci) : null
  const guidance = !choosingEnd
    ? null
    : cap
      ? `A távozás legkésőbb ${fmtDay(cap)} lehet, utána foglalt időszak jön. Válassz korábbi távozást vagy másik érkezést.`
      : 'Válaszd ki a távozás napját.'

  return (
    <div>
      <div className="mb-3 flex items-center justify-between">
        <button type="button" onClick={() => canPrev && setView(addMonths(view, -1))} disabled={!canPrev} aria-label="Előző hónap" className="btn btn-ghost !h-11 !min-h-11 !w-11 !p-0">‹</button>
        <div className="text-center font-display text-lg" aria-live="polite">
          {view.getFullYear()}. {MONTHS[view.getMonth()]}
          <span className="hidden md:inline"> – {addMonths(view, 1).getFullYear()}. {MONTHS[addMonths(view, 1).getMonth()]}</span>
        </div>
        <button type="button" onClick={() => setView(addMonths(view, 1))} aria-label="Következő hónap" className="btn btn-ghost !h-11 !min-h-11 !w-11 !p-0">›</button>
      </div>

      {state === 'error' && (
        <div role="alert" className="mb-3 rounded-[var(--radius-md)] border border-danger/30 bg-danger/5 px-4 py-3 text-sm">
          <p className="font-semibold text-danger">A foglaltságot most nem sikerült betölteni.</p>
          <p className="mt-1 text-ink/80">
            Hívj minket: <a className="font-semibold underline underline-offset-2" href={telHref(contact.phone)}>{contact.phone}</a>
            {contact.email && <> · <a className="font-semibold underline underline-offset-2" href={`mailto:${contact.email}`}>{contact.email}</a></>}
          </p>
          <button type="button" className="mt-2 font-semibold text-action underline underline-offset-2" onClick={() => { setState('loading'); setAttempt((n) => n + 1) }}>
            Újrapróbálom
          </button>
        </div>
      )}

      {(checkIn || checkOut) && (
        <div className="mb-3 flex items-center justify-between gap-3 rounded-[var(--radius-md)] border border-line bg-paper/60 px-3 py-2 text-sm">
          <span className="text-ink/85">
            {ci && <><span className="font-semibold">{fmtDay(ci)}</span>{co ? <> – <span className="font-semibold">{fmtDay(co)}</span></> : <span className="text-muted"> → válaszd ki a távozást</span>}</>}
          </span>
          <button type="button" onClick={() => { setHover(null); onSelect(null, null) }} className="min-h-11 shrink-0 px-1 font-semibold text-action underline underline-offset-2">
            Dátum törlése
          </button>
        </div>
      )}

      <div className="grid gap-6 md:grid-cols-2" onMouseLeave={() => setHover(null)} aria-busy={state === 'loading'}>
        <MonthGrid month={view} dayMeta={dayMeta} onPick={clickDay} onHover={setHover} choosingEnd={choosingEnd} />
        <div className="hidden md:block">
          <MonthGrid month={addMonths(view, 1)} dayMeta={dayMeta} onPick={clickDay} onHover={setHover} choosingEnd={choosingEnd} />
        </div>
      </div>

      {guidance && (
        <p role="status" aria-live="polite" className={`mt-3 rounded-[var(--radius-md)] px-3 py-2 text-sm ${cap ? 'bg-clay/10 text-action-hover' : 'bg-paper-2 text-deep'}`}>
          {guidance}
        </p>
      )}

      <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted">
        <Legend swatch="bg-cream border border-line" label="szabad" />
        <Legend swatch="bg-action" label="kiválasztva" />
        <Legend swatch="bg-paper-2" label="foglalt" />
        {state === 'loading' && <span aria-live="polite">foglaltság betöltése…</span>}
      </div>
    </div>
  )
}

function Legend({ swatch, label }: { swatch: string; label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className={`inline-block h-3 w-3 rounded-[3px] ${swatch}`} aria-hidden="true" />
      {label}
    </span>
  )
}

function MonthGrid({
  month, dayMeta, onPick, onHover, choosingEnd,
}: {
  month: Date
  dayMeta: (d: Date) => DayMeta
  onPick: (d: Date, m: DayMeta) => void
  onHover: (d: Date | null) => void
  choosingEnd: boolean
}) {
  const first = startOfMonth(month)
  const lead = wd(first)
  const daysInMonth = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate()
  const cells: (Date | null)[] = []
  for (let i = 0; i < lead; i++) cells.push(null)
  for (let d = 1; d <= daysInMonth; d++) cells.push(new Date(month.getFullYear(), month.getMonth(), d))

  return (
    <div>
      <div className="mb-1 grid grid-cols-7 text-center text-[0.72rem] font-semibold text-muted" aria-hidden="true">
        {DOW.map((d) => <div key={d} className="py-1">{d}</div>)}
      </div>
      <div className="grid grid-cols-7 gap-1">
        {cells.map((day, i) => {
          if (!day) return <div key={i} />
          const m = dayMeta(day)
          let cls = 'flex h-11 items-center justify-center rounded-[8px] text-sm tnum transition-colors '
          if (m.isStart || m.isEnd) cls += 'bg-action text-cream font-semibold'
          else if (m.inRange) cls += 'bg-clay/25 text-ink'
          else if (m.isOccupied && !m.isPast) cls += 'bg-paper-2 text-muted line-through cursor-help'
          else if (!m.selectable) cls += 'text-ink/30 cursor-not-allowed'
          else cls += 'bg-cream border border-line text-ink hover:border-water'
          const label = `${day.getFullYear()}. ${MONTHS[day.getMonth()]} ${day.getDate()}.${m.isOccupied ? ', foglalt' : !m.selectable ? ', nem választható' : ''}`
          return (
            <button
              key={i}
              type="button"
              onClick={() => onPick(day, m)}
              onMouseEnter={() => choosingEnd && m.selectable && onHover(day)}
              disabled={m.isPast && !m.selectable}
              aria-disabled={!m.selectable || undefined}
              aria-pressed={m.isStart || m.isEnd}
              aria-label={label}
              className={cls}
            >
              {day.getDate()}
            </button>
          )
        })}
      </div>
    </div>
  )
}
