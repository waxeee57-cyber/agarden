'use client'

import { useEffect, useMemo, useState } from 'react'

// ---- tiny local date helpers (no dep) ----
const pad = (n: number) => String(n).padStart(2, '0')
const toISO = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
const parseISO = (s: string) => { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d) }
const addDays = (d: Date, n: number) => { const x = new Date(d); x.setDate(x.getDate() + n); return x }
const addMonths = (d: Date, n: number) => new Date(d.getFullYear(), d.getMonth() + n, 1)
const startOfMonth = (d: Date) => new Date(d.getFullYear(), d.getMonth(), 1)
const sameDay = (a: Date, b: Date) => toISO(a) === toISO(b)
// Monday-first weekday index (0=Mon … 6=Sun)
const wd = (d: Date) => (d.getDay() + 6) % 7

const MONTHS = ['január', 'február', 'március', 'április', 'május', 'június', 'július', 'augusztus', 'szeptember', 'október', 'november', 'december']
const DOW = ['H', 'K', 'Sze', 'Cs', 'P', 'Szo', 'V']

type Range = { during: string; kind: string }

export function Calendar({
  listingId,
  checkIn,
  checkOut,
  onSelect,
}: {
  listingId: string
  checkIn: string | null
  checkOut: string | null
  onSelect: (checkIn: string | null, checkOut: string | null) => void
}) {
  const today = useMemo(() => parseISO(toISO(new Date())), [])
  const [view, setView] = useState<Date>(() => startOfMonth(new Date()))
  const [occupied, setOccupied] = useState<Set<string>>(new Set())
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    // loading starts true (initial state); all setState is in promise callbacks,
    // never synchronously in the effect body.
    const from = toISO(today)
    const to = toISO(addDays(today, 365))
    fetch(`/api/availability?listingId=${encodeURIComponent(listingId)}&from=${from}&to=${to}`)
      .then((r) => r.json())
      .then((data: { ok?: boolean; ranges?: Range[] }) => {
        const set = new Set<string>()
        for (const r of data.ranges ?? []) {
          const m = r.during.match(/(\d{4}-\d{2}-\d{2}),(\d{4}-\d{2}-\d{2})/)
          if (!m) continue
          let d = parseISO(m[1])
          const end = parseISO(m[2]) // exclusive
          while (d < end) { set.add(toISO(d)); d = addDays(d, 1) }
        }
        setOccupied(set)
      })
      .catch(() => setOccupied(new Set()))
      .finally(() => setLoading(false))
  }, [listingId, today])

  const ci = checkIn ? parseISO(checkIn) : null
  const co = checkOut ? parseISO(checkOut) : null

  // No occupied night in [a, b)?  (a inclusive, b exclusive — half-open)
  const spanFree = (a: Date, b: Date) => {
    let d = new Date(a)
    while (d < b) { if (occupied.has(toISO(d))) return false; d = addDays(d, 1) }
    return true
  }

  function clickDay(day: Date) {
    const iso = toISO(day)
    // choosing a START (nothing selected, or a full range already chosen)
    if (!ci || (ci && co)) {
      onSelect(iso, null)
      return
    }
    // choosing an END
    if (day <= ci) { onSelect(iso, null); return }      // earlier → restart
    if (spanFree(ci, day)) { onSelect(checkIn, iso); return } // valid end (day may be a booked turnover day)
    onSelect(iso, null)                                  // can't bridge a booked night → restart
  }

  function dayMeta(day: Date) {
    const iso = toISO(day)
    const isPast = day < today
    const isOccupied = occupied.has(iso)
    const isStart = ci && sameDay(day, ci)
    const isEnd = co && sameDay(day, co)
    const inRange = ci && co && day > ci && day < co
    // selectable?
    let selectable: boolean
    if (ci && !co && day > ci) selectable = spanFree(ci, day)         // picking end (turnover day allowed)
    else selectable = !isPast && !isOccupied                          // picking start
    return { iso, isPast, isOccupied, isStart, isEnd, inRange, selectable }
  }

  const canPrev = startOfMonth(today) < view

  return (
    <div>
      <div className="mb-3 flex items-center justify-between">
        <button
          type="button"
          onClick={() => canPrev && setView(addMonths(view, -1))}
          disabled={!canPrev}
          aria-label="Előző hónap"
          className="btn btn-ghost !min-h-10 !px-3 !py-2"
        >‹</button>
        <div className="text-center font-display text-lg">
          {view.getFullYear()}. {MONTHS[view.getMonth()]}
          <span className="hidden md:inline"> – {addMonths(view, 1).getFullYear()}. {MONTHS[addMonths(view, 1).getMonth()]}</span>
        </div>
        <button
          type="button"
          onClick={() => setView(addMonths(view, 1))}
          aria-label="Következő hónap"
          className="btn btn-ghost !min-h-10 !px-3 !py-2"
        >›</button>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <MonthGrid month={view} today={today} dayMeta={dayMeta} onPick={clickDay} />
        <div className="hidden md:block">
          <MonthGrid month={addMonths(view, 1)} today={today} dayMeta={dayMeta} onPick={clickDay} />
        </div>
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-reed">
        <Legend swatch="bg-cream border border-line" label="szabad" />
        <Legend swatch="bg-clay" label="kiválasztva" />
        <Legend swatch="bg-sand-2 line-through" label="foglalt" />
        {loading && <span aria-live="polite">elérhetőség betöltése…</span>}
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
  month,
  dayMeta,
  onPick,
}: {
  month: Date
  today: Date
  dayMeta: (d: Date) => { iso: string; isPast: boolean; isOccupied: boolean; isStart: boolean | null; isEnd: boolean | null; inRange: boolean | null; selectable: boolean }
  onPick: (d: Date) => void
}) {
  const first = startOfMonth(month)
  const lead = wd(first)
  const daysInMonth = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate()
  const cells: (Date | null)[] = []
  for (let i = 0; i < lead; i++) cells.push(null)
  for (let d = 1; d <= daysInMonth; d++) cells.push(new Date(month.getFullYear(), month.getMonth(), d))

  return (
    <div>
      <div className="mb-1 grid grid-cols-7 text-center text-[0.7rem] font-semibold text-reed">
        {DOW.map((d) => <div key={d} className="py-1">{d}</div>)}
      </div>
      <div className="grid grid-cols-7 gap-1">
        {cells.map((day, i) => {
          if (!day) return <div key={i} />
          const m = dayMeta(day)
          const base = 'flex h-10 items-center justify-center rounded-[8px] text-sm tnum transition-colors'
          let cls = `${base} `
          if (m.isStart || m.isEnd) cls += 'bg-clay text-cream font-semibold'
          else if (m.inRange) cls += 'bg-clay/20 text-ink'
          else if (m.isOccupied) cls += 'bg-sand-2 text-reed line-through'
          else if (m.isPast) cls += 'text-reed/40'
          else cls += 'bg-cream border border-line text-ink hover:border-water'
          return (
            <button
              key={i}
              type="button"
              onClick={() => onPick(day)}
              disabled={!m.selectable}
              aria-pressed={!!(m.isStart || m.isEnd)}
              aria-label={`${day.getFullYear()}. ${MONTHS[day.getMonth()]} ${day.getDate()}.${m.isOccupied ? ' — foglalt' : ''}`}
              title={m.isOccupied ? 'Foglalt' : undefined}
              className={`${cls} disabled:cursor-not-allowed`}
            >
              {day.getDate()}
            </button>
          )
        })}
      </div>
    </div>
  )
}
