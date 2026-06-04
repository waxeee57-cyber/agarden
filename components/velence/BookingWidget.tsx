'use client'

import { useEffect, useRef, useState } from 'react'
import { Calendar } from './Calendar'
import { formatHuf } from '@/lib/format'
import type { VelenceListing } from '@/lib/velence'

// Shape returned by POST /api/quote (mirrors lib/booking QuoteBreakdown).
type Quote = {
  valid: boolean
  reason: string | null
  nights: number
  subtotal: number | null
  surcharges: { code: string; label: string; amount: number }[]
  total: number | null
  currency: string
  pricingMode: string | null
}

// Normalized API error code -> human Hungarian copy. (No logic, just wording.)
function humanError(code: string | null | undefined): string {
  switch (code) {
    case 'overlap': return 'Ez az időszak már foglalt. Kérlek válassz másik dátumot.'
    case 'min_nights': return 'Minimum 2 éj foglalható — 1 éj felár ellenében lehetséges.'
    case 'invalid_dates': return 'A távozás dátuma legyen későbbi az érkezésnél.'
    case 'capacity_unavailable': return 'Ehhez a létszámhoz nem foglalható fix áron — kérj ajánlatot, és egyeztetünk.'
    case 'listing_not_found': return 'A ház jelenleg nem elérhető.'
    case 'validation_error': return 'Ellenőrizd a megadott adatokat.'
    default: return 'Váratlan hiba történt. Próbáld újra, vagy keress minket telefonon.'
  }
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export function BookingWidget({ listing }: { listing: VelenceListing }) {
  const maxGuests = listing.capacityMax + listing.capacityExtra

  const [mode, setMode] = useState<'book' | 'inquiry'>('book')
  const [checkIn, setCheckIn] = useState<string | null>(null)
  const [checkOut, setCheckOut] = useState<string | null>(null)
  const [guests, setGuests] = useState(2)
  const [pet, setPet] = useState(false)
  const [isEvent, setIsEvent] = useState(false)

  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [message, setMessage] = useState('')

  const [quote, setQuote] = useState<Quote | null>(null)
  const [quoteLoading, setQuoteLoading] = useState(false)

  const [errors, setErrors] = useState<Record<string, string>>({})
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [success, setSuccess] = useState<null | { kind: 'book' | 'inquiry'; id?: string; total?: number | null }>(null)

  // Live quote on every relevant change (debounced). The server is the source of
  // truth — we never compute price here.
  const debounce = useRef<ReturnType<typeof setTimeout> | null>(null)
  useEffect(() => {
    // All setState happens inside the (async) timeout callback — never
    // synchronously in the effect body (react-hooks/set-state-in-effect).
    if (debounce.current) clearTimeout(debounce.current)
    debounce.current = setTimeout(async () => {
      if (!checkIn || !checkOut) { setQuote(null); return }
      setQuoteLoading(true)
      try {
        const res = await fetch('/api/quote', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ listingId: listing.listingId, checkIn, checkOut, guests, pet, isEvent }),
        })
        setQuote(await res.json())
      } catch {
        setQuote(null)
      } finally {
        setQuoteLoading(false)
      }
    }, 320)
    return () => { if (debounce.current) clearTimeout(debounce.current) }
  }, [checkIn, checkOut, guests, pet, isEvent, listing.listingId])

  function validate(): boolean {
    const e: Record<string, string> = {}
    if (name.trim().length < 2) e.name = 'Add meg a neved.'
    if (!EMAIL_RE.test(email)) e.email = 'Érvényes e-mail cím szükséges.'
    if (phone && phone.trim().length < 5) e.phone = 'Érvényes telefonszám.'
    if (mode === 'book') {
      if (!checkIn || !checkOut) e.dates = 'Válassz érkezési és távozási dátumot.'
      if (guests < 1 || guests > maxGuests) e.guests = `1–${maxGuests} fő.`
    }
    setErrors(e)
    return Object.keys(e).length === 0
  }

  async function submit() {
    setSubmitError(null)
    if (!validate()) return
    setSubmitting(true)
    try {
      if (mode === 'book') {
        const res = await fetch('/api/booking', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({
            listingId: listing.listingId, checkIn, checkOut, guests, pet, isEvent,
            guestName: name.trim(), guestEmail: email.trim(),
            ...(phone.trim() ? { guestPhone: phone.trim() } : {}),
          }),
        })
        const data = await res.json()
        if (data.ok) setSuccess({ kind: 'book', id: data.bookingId, total: data.total })
        else setSubmitError(humanError(data.reason))
      } else {
        const res = await fetch('/api/quote-request', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({
            listingId: listing.listingId,
            guestName: name.trim(), guestEmail: email.trim(),
            ...(phone.trim() ? { guestPhone: phone.trim() } : {}),
            ...(checkIn ? { checkIn } : {}),
            ...(checkOut ? { checkOut } : {}),
            ...(guests ? { guests } : {}),
            pet, isEvent,
            ...(message.trim() ? { message: message.trim() } : {}),
          }),
        })
        const data = await res.json()
        if (data.ok) setSuccess({ kind: 'inquiry', id: data.bookingId })
        else setSubmitError(humanError(data.reason))
      }
    } catch {
      setSubmitError(humanError('unknown'))
    } finally {
      setSubmitting(false)
    }
  }

  if (success) {
    return (
      <div className="card p-7 md:p-9">
        <div className="label-caps">{success.kind === 'book' ? 'Foglalás rögzítve' : 'Ajánlatkérés elküldve'}</div>
        <h3 className="mt-2 text-2xl">{success.kind === 'book' ? 'Köszönjük a foglalást!' : 'Köszönjük, hamarosan jelentkezünk.'}</h3>
        <p className="mt-3 text-ink/80">
          {success.kind === 'book'
            ? 'A foglalásod rögzítettük (állapot: függőben). E-mailben visszaigazoljuk a részleteket és a végleges ajánlatot.'
            : 'Ajánlatkérésedet megkaptuk. Munkanapokon 8–18 óra között válaszolunk e-mailben vagy telefonon.'}
        </p>
        <dl className="mt-5 space-y-1 text-sm">
          {success.id && <Row dt="Azonosító" dd={<span className="tnum">{success.id.slice(0, 8)}</span>} />}
          {success.kind === 'book' && success.total != null && <Row dt="Tájékoztató végösszeg" dd={<span className="tnum">{formatHuf(success.total)}</span>} />}
        </dl>
        <p className="mt-5 text-sm text-reed">gardenvendeghazvelence@gmail.com · +36 20 497 1994</p>
      </div>
    )
  }

  return (
    <div className="card overflow-hidden">
      {/* Mode toggle */}
      <div className="grid grid-cols-2 border-b border-line">
        {(['book', 'inquiry'] as const).map((m) => (
          <button
            key={m}
            type="button"
            onClick={() => { setMode(m); setSubmitError(null); setErrors({}) }}
            aria-pressed={mode === m}
            className={`px-4 py-4 text-sm font-semibold transition-colors ${mode === m ? 'bg-pine text-cream' : 'bg-cream text-pine hover:bg-sand-2'}`}
          >
            {m === 'book' ? 'Foglalás (online)' : 'Ajánlatkérés'}
          </button>
        ))}
      </div>

      <div className="grid gap-7 p-6 md:grid-cols-[1.1fr_0.9fr] md:p-8">
        {/* LEFT: dates + party */}
        <div>
          <div className="label-caps">Dátum</div>
          <p className="mt-1 mb-3 text-sm text-reed">
            {mode === 'book' ? 'Válaszd ki az érkezést és a távozást.' : 'Dátum megadása opcionális — írd meg, mire gondolsz.'}
            {' '}A távozás napja másnak már érkezési nap lehet.
          </p>
          <Calendar
            listingId={listing.listingId}
            checkIn={checkIn}
            checkOut={checkOut}
            onSelect={(ci, co) => { setCheckIn(ci); setCheckOut(co); setErrors((e) => ({ ...e, dates: '' })) }}
          />
          {errors.dates && <p className="err mt-2">{errors.dates}</p>}

          <div className="mt-6 grid gap-5 sm:grid-cols-2">
            <div>
              <div className="label-caps">Létszám</div>
              <div className="mt-2 flex items-center gap-3">
                <Stepper value={guests} min={1} max={maxGuests} onChange={setGuests} />
                <span className="text-sm text-reed">max {listing.capacityMax}+{listing.capacityExtra} fő</span>
              </div>
              {errors.guests && <p className="err mt-1">{errors.guests}</p>}
            </div>
            <div>
              <div className="label-caps">Extrák</div>
              <div className="mt-2 flex flex-col gap-2">
                <Toggle checked={pet} onChange={setPet} label="Kisállat (kistestű, felár)" />
                <Toggle checked={isEvent} onChange={setIsEvent} label="Rendezvény / búcsú (eltérő ár)" />
              </div>
            </div>
          </div>
        </div>

        {/* RIGHT: quote + form */}
        <div className="flex flex-col gap-5">
          <QuotePanel quote={quote} loading={quoteLoading} listing={listing} hasDates={!!(checkIn && checkOut)} />

          <div className="grid gap-3">
            <div className="field">
              <label htmlFor="bw-name">Név</label>
              <input id="bw-name" className="input" value={name} onChange={(e) => setName(e.target.value)} aria-invalid={!!errors.name} autoComplete="name" />
              {errors.name && <p className="err">{errors.name}</p>}
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="field">
                <label htmlFor="bw-email">E-mail</label>
                <input id="bw-email" type="email" className="input" value={email} onChange={(e) => setEmail(e.target.value)} aria-invalid={!!errors.email} autoComplete="email" />
                {errors.email && <p className="err">{errors.email}</p>}
              </div>
              <div className="field">
                <label htmlFor="bw-phone">Telefon <span className="text-reed font-normal">(opcionális)</span></label>
                <input id="bw-phone" type="tel" className="input" value={phone} onChange={(e) => setPhone(e.target.value)} aria-invalid={!!errors.phone} autoComplete="tel" />
                {errors.phone && <p className="err">{errors.phone}</p>}
              </div>
            </div>
            {mode === 'inquiry' && (
              <div className="field">
                <label htmlFor="bw-msg">Üzenet <span className="text-reed font-normal">(opcionális)</span></label>
                <textarea id="bw-msg" className="input" rows={3} value={message} onChange={(e) => setMessage(e.target.value)} placeholder="Pl. hétvége 8 főre, érdeklődöm az árról…" />
              </div>
            )}
          </div>

          {submitError && <p className="err" role="alert">{submitError}</p>}

          <button type="button" className={`btn ${mode === 'book' ? 'btn-primary' : 'btn-dark'}`} onClick={submit} disabled={submitting}>
            {submitting ? 'Küldés…' : mode === 'book' ? 'Foglalás' : 'Ajánlatkérés küldése'}
          </button>
          <p className="text-center text-xs text-reed">
            {mode === 'book'
              ? 'A foglalás nem von le pénzt — a végleges ajánlatot visszaigazoljuk.'
              : 'Az ajánlatkérés nem foglal le dátumot.'}
          </p>
        </div>
      </div>
    </div>
  )
}

function QuotePanel({ quote, loading, listing, hasDates }: { quote: Quote | null; loading: boolean; listing: VelenceListing; hasDates: boolean }) {
  if (!hasDates) {
    return (
      <div className="rounded-[var(--radius-lg)] border border-dashed border-line p-5 text-sm text-reed">
        Válassz dátumot a tájékoztató ár megjelenítéséhez. Fix nyilvános ár helyett személyre szabott ajánlatot adunk.
      </div>
    )
  }
  if (loading && !quote) return <div className="rounded-[var(--radius-lg)] border border-line p-5 text-sm text-reed">Ár számítása…</div>
  if (!quote) return null

  if (!quote.valid) {
    return (
      <div className="rounded-[var(--radius-lg)] border border-clay/40 bg-clay/10 p-5">
        <div className="label-caps">Megjegyzés</div>
        <p className="mt-1 text-sm text-ink/85">{humanError(quote.reason)}</p>
      </div>
    )
  }

  const nightly = quote.nights && quote.subtotal != null ? Math.round(quote.subtotal / quote.nights) : listing.nightlyRate
  const isDemo = (quote.pricingMode ?? listing.pricingMode) === 'demo'

  return (
    <div className="rounded-[var(--radius-lg)] border border-line bg-sand/60 p-5">
      <div className="flex items-baseline justify-between">
        <div className="label-caps">Tájékoztató ár</div>
        <div className="text-sm text-reed tnum">{quote.nights} éj</div>
      </div>
      <dl className="mt-3 space-y-1.5 text-sm">
        <Row dt={<span className="tnum">{quote.nights} éj × {formatHuf(nightly)}</span>} dd={<span className="tnum">{formatHuf(quote.subtotal)}</span>} />
        {quote.surcharges.map((s) => (
          <Row key={s.code} dt={s.label} dd={<span className="tnum">+{formatHuf(s.amount)}</span>} />
        ))}
      </dl>
      <div className="mt-3 flex items-baseline justify-between border-t border-line pt-3">
        <span className="font-display text-lg">Végösszeg</span>
        <span className="font-display text-2xl tnum text-pine">{formatHuf(quote.total)}</span>
      </div>
      {isDemo && (
        <p className="mt-3 text-xs text-reed">
          Tájékoztató ár — a végleges ajánlatot e-mailben visszaigazoljuk. (A ház ára egyedi ajánlat alapján alakul.)
        </p>
      )}
    </div>
  )
}

function Row({ dt, dd }: { dt: React.ReactNode; dd: React.ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-4">
      <dt className="text-ink/75">{dt}</dt>
      <dd className="font-medium">{dd}</dd>
    </div>
  )
}

function Stepper({ value, min, max, onChange }: { value: number; min: number; max: number; onChange: (n: number) => void }) {
  return (
    <div className="inline-flex items-center gap-1 rounded-full border border-line bg-cream p-1">
      <button type="button" aria-label="Kevesebb fő" className="btn btn-ghost !min-h-9 !w-9 !p-0 !border-0" onClick={() => onChange(Math.max(min, value - 1))} disabled={value <= min}>−</button>
      <span className="w-8 text-center font-semibold tnum" aria-live="polite">{value}</span>
      <button type="button" aria-label="Több fő" className="btn btn-ghost !min-h-9 !w-9 !p-0 !border-0" onClick={() => onChange(Math.min(max, value + 1))} disabled={value >= max}>+</button>
    </div>
  )
}

function Toggle({ checked, onChange, label }: { checked: boolean; onChange: (b: boolean) => void; label: string }) {
  return (
    <label className="flex cursor-pointer items-center gap-2.5 text-sm">
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors ${checked ? 'bg-clay' : 'bg-line'}`}
      >
        <span className={`inline-block h-5 w-5 transform rounded-full bg-cream transition-transform ${checked ? 'translate-x-5' : 'translate-x-0.5'}`} />
      </button>
      <span>{label}</span>
    </label>
  )
}
