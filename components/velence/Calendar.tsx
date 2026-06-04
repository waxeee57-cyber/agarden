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
const fmtDay = (d: Date) => `${MONTHS[d.getMonth()]} ${d.getDate()}.`

type Range = { during: string; kind: string }

type DayMeta = {
  isPast: boolean
  isOccupied: boolean
  isStart: boolean
  isEnd: boolean
  inRange: boolean
  selectable: boolean
}

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
  const [hover, setHover] = useState<Date | null>(null) // live range preview while choosing checkout

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

  // First booked day strictly after the check-in (caps the selectable checkout —
  // that booked day is itself still a valid checkout via same-day turnover).
  const firstBookedAfter = (a: Date): Date | null => {
    for (let i = 1; i <= 366; i++) {
      const d = addDays(a, i)
      if (occupied.has(toISO(d))) return d
    }
    return null
  }

  // Range end actually shown: committed checkout, else a valid hover preview.
  const previewEnd: Date | null =
    co ?? (ci && hover && hover > ci && spanFree(ci, hover) ? hover : null)

  function clickDay(day: Date) {
    const iso = toISO(day)
    // choosing a START (nothing selected, or a full range already chosen)
    if (!ci || (ci && co)) {
      setHover(null)
      onSelect(iso, null)
      return
    }
    // choosing an END (check-in set, no checkout yet)
    if (sameDay(day, ci)) { setHover(null); onSelect(null, null); return } // click the check-in again → DESELECT
    if (day < ci) { onSelect(iso, null); return }              // earlier day → move check-in there
    if (spanFree(ci, day)) { onSelect(checkIn, iso); return }   // valid end (day may be a booked turnover day)
    onSelect(iso, null)                                         // can't bridge a booked night → restart
  }

  function clearSelection() {
    setHover(null)
    onSelect(null, null)
  }

  function dayMeta(day: Date): DayMeta {
    const iso = toISO(day)
    const isPast = day < today
    const isOccupied = occupied.has(iso)
    const isStart = !!ci && sameDay(day, ci)
    const isEnd = !!previewEnd && sameDay(day, previewEnd)
    const inRange = !!ci && !!previewEnd && day > ci && day < previewEnd
    let selectable: boolean
    if (ci && !co && day > ci) selectable = spanFree(ci, day)   // picking end (turnover day allowed)
    else selectable = !isPast && !isOccupied                    // picking start
    return { isPast, isOccupied, isStart, isEnd, inRange, selectable }
  }

  const canPrev = startOfMonth(today) < view

  // Proactive inline guidance while a checkout is still being chosen.
  const choosingEnd = !!ci && !co
  const cap = ci ? firstBookedAfter(ci) : null
  const guidance = !choosingEnd
    ? null
    : cap
      ? `A távozás legkésőbb ${fmtDay(cap)} lehet — utána foglalt időszak következik. Válassz korábbi távozást vagy másik érkezést.`
      : 'Válaszd ki a távozás napját.'

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

      {/* Selection summary + one-click clear — only while something is selected. */}
      {(checkIn || checkOut) && (
        <div className="mb-3 flex items-center justify-between gap-3 rounded-[var(--radius-md)] border border-line bg-sand/60 px-3 py-2 text-sm">
          <span className="text-ink/80">
            {ci ? <><span className="font-semibold">{fmtDay(ci)}</span>{co ? <> – <span className="font-semibold">{fmtDay(co)}</span></> : <span className="text-reed"> → távozás kiválasztása</span>}</> : null}
          </span>
          <button type="button" onClick={clearSelection} className="shrink-0 font-semibold text-clay-600 underline underline-offset-2 hover:text-clay">
            Dátum törlése
          </button>
        </div>
      )}

      <div className="grid gap-6 md:grid-cols-2" onMouseLeave={() => setHover(null)}>
        <MonthGrid month={view} dayMeta={dayMeta} onPick={clickDay} onHover={setHover} choosingEnd={choosingEnd} />
        <div className="hidden md:block">
          <MonthGrid month={addMonths(view, 1)} dayMeta={dayMeta} onPick={clickDay} onHover={setHover} choosingEnd={choosingEnd} />
        </div>
      </div>

      {/* Proactive guidance — appears while choosing checkout, clears once a valid range is set. */}
      {guidance && (
        <p
          role="status"
          aria-live="polite"
          className={`mt-3 rounded-[var(--radius-md)] px-3 py-2 text-sm ${cap ? 'bg-clay/10 text-clay-600' : 'bg-sand-2 text-pine'}`}
        >
          {guidance}
        </p>
      )}

      <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-reed">
        <Legend swatch="bg-cream border border-line" label="szabad" />
        <Legend swatch="bg-clay" label="kiválasztva" />
        <Legend swatch="bg-sand-2 line-through" label="foglalt" />
        <Legend swatch="bg-transparent text-reed/40 border border-dashed border-line" label="nem foglalható" />
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
  onHover,
  choosingEnd,
}: {
  month: Date
  dayMeta: (d: Date) => DayMeta
  onPick: (d: Date) => void
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
          else if (m.inRange) cls += 'bg-clay/25 text-ink'
          else if (m.isOccupied) cls += 'bg-sand-2 text-reed line-through'
          else if (!m.selectable) cls += 'text-reed/35'                    // past OR blocked future → clearly inactive
          else cls += 'bg-cream border border-line text-ink hover:border-water'
          return (
            <button
              key={i}
              type="button"
              onClick={() => onPick(day)}
              onMouseEnter={() => choosingEnd && m.selectable && onHover(day)}
              disabled={!m.selectable}
              aria-pressed={m.isStart || m.isEnd}
              aria-label={`${day.getFullYear()}. ${MONTHS[day.getMonth()]} ${day.getDate()}.${m.isOccupied ? ' — foglalt' : !m.selectable ? ' — nem foglalható' : ''}`}
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
