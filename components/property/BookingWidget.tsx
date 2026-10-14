'use client'

import { useEffect, useRef, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { Calendar, addDays, parseISO, toISO, fmtDay } from './Calendar'
import { formatHuf } from '@/lib/format'
import { telHref } from '@/lib/brand'

// Booking + quote request for the CURRENT host's house. The client never sends
// a listing id: every /api route resolves the house from the request host.

export type WidgetListing = {
  siteName: string
  capacityMax: number
  capacityExtra: number
  minNights: number
  pricingMode: 'fixed' | 'quote' | 'demo'
  phone: string
  email: string | null
  singleNightAllowed: boolean
}
export type SisterInfo = { name: string; origin: string; pitch: string }

type Quote = {
  valid: boolean
  reason: string | null
  nights: number
  subtotal: number | null
  surcharges: { code: string; label: string; amount: number }[]
  total: number | null
  pricingMode: string | null
}

function humanError(code: string | null | undefined, minNights: number): string {
  switch (code) {
    case 'overlap': return 'Ez az időszak közben foglalt lett. Válassz másik dátumot.'
    case 'min_nights': return `Legalább ${minNights} éjszaka foglalható. 1 éjszakás tartózkodáshoz kérj ajánlatot.`
    case 'invalid_dates': return 'A távozás legyen későbbi az érkezésnél.'
    case 'capacity_unavailable': return 'Ennyi főre a ház nem foglalható. Kérj ajánlatot, és egyeztetünk.'
    case 'listing_not_found': return 'A ház jelenleg nem foglalható online.'
    case 'validation_error': return 'Ellenőrizd a megadott adatokat.'
    case 'rate_limited': return 'Túl sok próbálkozás. Várj pár percet, vagy hívj minket.'
    default: return 'Nem sikerült elküldeni. Próbáld újra, vagy hívj minket.'
  }
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const ISO_RE = /^\d{4}-\d{2}-\d{2}$/

export function BookingWidget({ listing, sister }: { listing: WidgetListing; sister: SisterInfo }) {
  const maxGuests = listing.capacityMax + listing.capacityExtra
  const params = useSearchParams()
  const initIn = params.get('checkIn')
  const initOut = params.get('checkOut')
  const valid = (s: string | null) => !!s && ISO_RE.test(s) && s >= toISO(new Date())

  const [mode, setMode] = useState<'book' | 'inquiry'>('book')
  const [checkIn, setCheckIn] = useState<string | null>(valid(initIn) ? initIn : null)
  const [checkOut, setCheckOut] = useState<string | null>(valid(initIn) && valid(initOut) && initOut! > initIn! ? initOut : null)
  const [guests, setGuests] = useState(Math.min(4, maxGuests))
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
  const [sisterOffer, setSisterOffer] = useState<null | { href: string; from: string; to: string }>(null)
  const [success, setSuccess] = useState<null | { kind: 'book' | 'inquiry'; id?: string; total?: number | null }>(null)

  const debounce = useRef<ReturnType<typeof setTimeout> | null>(null)
  useEffect(() => {
    if (debounce.current) clearTimeout(debounce.current)
    debounce.current = setTimeout(async () => {
      if (!checkIn || !checkOut) { setQuote(null); return }
      setQuoteLoading(true)
      try {
        const res = await fetch('/api/quote', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ checkIn, checkOut, guests, pet, isEvent }),
        })
        setQuote(await res.json())
      } catch {
        setQuote(null)
      } finally {
        setQuoteLoading(false)
      }
    }, 300)
    return () => { if (debounce.current) clearTimeout(debounce.current) }
  }, [checkIn, checkOut, guests, pet, isEvent])

  async function checkSister(from: string, to: string) {
    try {
      const res = await fetch(`/api/sister-availability?checkIn=${from}&checkOut=${to}`, { cache: 'no-store' })
      const data = (await res.json()) as { ok: boolean; free?: boolean; href?: string }
      setSisterOffer(data.ok && data.free && data.href ? { href: data.href, from, to } : null)
    } catch {
      setSisterOffer(null)
    }
  }

  function onBlockedPick(dayIso: string) {
    void checkSister(dayIso, toISO(addDays(parseISO(dayIso), Math.max(listing.minNights, 1))))
  }

  function validate(): boolean {
    const e: Record<string, string> = {}
    if (name.trim().length < 2) e.name = 'Add meg a neved.'
    if (!EMAIL_RE.test(email.trim())) e.email = 'Érvényes e-mail cím kell a visszaigazoláshoz.'
    if (phone.trim() && phone.trim().length < 5) e.phone = 'Ellenőrizd a telefonszámot.'
    if (mode === 'book') {
      if (!checkIn || !checkOut) e.dates = 'Válaszd ki az érkezést és a távozást.'
      if (guests < 1 || guests > maxGuests) e.guests = `1–${maxGuests} fő.`
    }
    setErrors(e)
    return Object.keys(e).length === 0
  }

  async function submit(ev: React.FormEvent) {
    ev.preventDefault()
    setSubmitError(null)
    if (!validate()) return
    setSubmitting(true)
    const contact = {
      guestName: name.trim(),
      guestEmail: email.trim(),
      ...(phone.trim() ? { guestPhone: phone.trim() } : {}),
      ...(message.trim() ? { message: message.trim() } : {}),
    }
    try {
      const res = await fetch(mode === 'book' ? '/api/booking' : '/api/quote-request', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(
          mode === 'book'
            ? { checkIn, checkOut, guests, pet, isEvent, ...contact }
            : { ...(checkIn ? { checkIn } : {}), ...(checkOut ? { checkOut } : {}), guests, pet, isEvent, ...contact }
        ),
      })
      const data = await res.json()
      if (data.ok) setSuccess({ kind: mode, id: data.bookingId, total: data.total })
      else {
        setSubmitError(humanError(data.reason, listing.minNights))
        if (data.reason === 'overlap' && checkIn && checkOut) void checkSister(checkIn, checkOut)
      }
    } catch {
      setSubmitError(humanError('unknown', listing.minNights))
    } finally {
      setSubmitting(false)
    }
  }

  if (success) {
    return (
      <div className="card p-7 md:p-9" role="status">
        <div className="label-caps">{success.kind === 'book' ? 'Foglalási kérelem rögzítve' : 'Ajánlatkérés elküldve'}</div>
        <h3 className="mt-2 text-2xl">{success.kind === 'book' ? 'Köszönjük, megkaptuk!' : 'Köszönjük, hamarosan jelentkezünk.'}</h3>
        <p className="mt-3 text-ink/85">
          {success.kind === 'book'
            ? 'A dátumokat fenntartjuk, amíg e-mailben visszaigazoljuk a foglalást. Most nem vontunk le pénzt, a fizetés a helyszínen történik.'
            : 'Az ajánlatkérés nem foglal le dátumot. A részletekkel e-mailben vagy telefonon keresünk.'}
        </p>
        <dl className="mt-5 space-y-1 text-sm">
          {success.id && <Row dt="Azonosító" dd={<span className="tnum">{success.id.slice(0, 8)}</span>} />}
          {success.kind === 'book' && success.total != null && <Row dt="Tájékoztató végösszeg" dd={<span className="tnum">{formatHuf(success.total)}</span>} />}
        </dl>
        <p className="mt-5 text-sm text-muted">
          <a className="underline underline-offset-2" href={telHref(listing.phone)}>{listing.phone}</a>
          {listing.email && <> · <a className="underline underline-offset-2" href={`mailto:${listing.email}`}>{listing.email}</a></>}
        </p>
      </div>
    )
  }

  return (
    <form className="card overflow-hidden" onSubmit={submit} noValidate>
      <div className="grid grid-cols-2 border-b border-line" role="tablist" aria-label="Foglalás típusa">
        {(['book', 'inquiry'] as const).map((m) => (
          <button
            key={m}
            type="button"
            role="tab"
            aria-selected={mode === m}
            onClick={() => { setMode(m); setSubmitError(null); setErrors({}) }}
            className={`min-h-14 px-4 py-4 text-sm font-semibold transition-colors ${mode === m ? 'bg-deep text-cream' : 'bg-cream text-deep hover:bg-paper-2'}`}
          >
            {m === 'book' ? 'Foglalási kérelem' : 'Ajánlatkérés'}
          </button>
        ))}
      </div>

      <div className="grid gap-7 p-5 md:grid-cols-[1.1fr_0.9fr] md:p-8">
        <div>
          <div className="field-label">Dátum</div>
          <p className="mb-3 mt-1 text-sm text-muted">
            {mode === 'book' ? 'Válaszd ki az érkezést és a távozást.' : 'A dátum opcionális: írd meg, mire gondoltok.'} A távozás napja másnak már érkezési nap lehet.
          </p>
          <Calendar
            checkIn={checkIn}
            checkOut={checkOut}
            contact={{ phone: listing.phone, email: listing.email }}
            onBlockedPick={onBlockedPick}
            onSelect={(ci, co) => { setCheckIn(ci); setCheckOut(co); setSisterOffer(null); setErrors((e) => ({ ...e, dates: '' })) }}
          />
          {errors.dates && <p className="err mt-2">{errors.dates}</p>}

          {sisterOffer && (
            <div className="mt-4 rounded-[var(--radius-lg)] border border-accent/60 bg-accent/10 p-4" role="status">
              <p className="text-sm font-semibold text-deep">
                Ezek a napok nálunk foglaltak, de a testvérházunk szabad: {fmtDay(parseISO(sisterOffer.from))} – {fmtDay(parseISO(sisterOffer.to))}
              </p>
              <p className="mt-1 text-sm text-ink/80">{sister.pitch}</p>
              <a href={sisterOffer.href} className="btn btn-dark btn-sm mt-3">Megnézem: {sister.name}</a>
            </div>
          )}

          <div className="mt-6 grid gap-5 sm:grid-cols-2">
            <div>
              <div className="field-label" id="guests-label">Létszám</div>
              <div className="mt-2 flex items-center gap-3">
                <Stepper value={guests} min={1} max={maxGuests} onChange={setGuests} labelledBy="guests-label" />
                <span className="text-sm text-muted">max {listing.capacityMax}+{listing.capacityExtra} fő</span>
              </div>
              {errors.guests && <p className="err mt-1">{errors.guests}</p>}
            </div>
            <fieldset>
              <legend className="field-label">Extrák</legend>
              <div className="mt-2 flex flex-col gap-1">
                <Toggle checked={pet} onChange={setPet} label="Kistestű kisállat (felár)" />
                <Toggle checked={isEvent} onChange={setIsEvent} label="Rendezvény, búcsú (eltérő ár)" />
              </div>
            </fieldset>
          </div>
        </div>

        <div className="flex flex-col gap-5">
          <QuotePanel quote={quote} loading={quoteLoading} hasDates={!!(checkIn && checkOut)} mode={mode} listing={listing} />

          <div className="grid gap-3">
            <div className="field">
              <label htmlFor="bw-name">Név</label>
              <input id="bw-name" className="input" value={name} onChange={(e) => setName(e.target.value)} aria-invalid={!!errors.name} aria-describedby={errors.name ? 'bw-name-err' : undefined} autoComplete="name" />
              {errors.name && <p id="bw-name-err" className="err">{errors.name}</p>}
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="field">
                <label htmlFor="bw-email">E-mail</label>
                <input id="bw-email" type="email" inputMode="email" className="input" value={email} onChange={(e) => setEmail(e.target.value)} aria-invalid={!!errors.email} aria-describedby={errors.email ? 'bw-email-err' : undefined} autoComplete="email" />
                {errors.email && <p id="bw-email-err" className="err">{errors.email}</p>}
              </div>
              <div className="field">
                <label htmlFor="bw-phone">Telefon <span className="font-normal text-muted">(opcionális)</span></label>
                <input id="bw-phone" type="tel" inputMode="tel" className="input" value={phone} onChange={(e) => setPhone(e.target.value)} aria-invalid={!!errors.phone} autoComplete="tel" />
                {errors.phone && <p className="err">{errors.phone}</p>}
              </div>
            </div>
            <div className="field">
              <label htmlFor="bw-msg">Üzenet <span className="font-normal text-muted">(opcionális)</span></label>
              <textarea id="bw-msg" className="input" rows={3} value={message} onChange={(e) => setMessage(e.target.value)} placeholder={mode === 'book' ? 'Pl. érkezés időpontja, kérdések' : 'Pl. hétvége 8 főre, érdeklődünk az árról'} />
            </div>
          </div>

          {submitError && <p className="err" role="alert">{submitError}</p>}

          <button type="submit" className={`btn ${mode === 'book' ? 'btn-primary' : 'btn-dark'}`} disabled={submitting}>
            {submitting ? 'Küldés…' : mode === 'book' ? 'Foglalási kérelem küldése' : 'Ajánlatkérés küldése'}
          </button>
          <p className="text-center text-sm text-muted">
            {mode === 'book'
              ? 'Most nem vonunk le pénzt — visszaigazolás e-mailben, fizetés a helyszínen.'
              : 'Az ajánlatkérés nem foglal le dátumot.'}
          </p>
        </div>
      </div>
    </form>
  )
}

function QuotePanel({ quote, loading, hasDates, mode, listing }: { quote: Quote | null; loading: boolean; hasDates: boolean; mode: 'book' | 'inquiry'; listing: WidgetListing }) {
  const priced = listing.pricingMode === 'fixed'
  if (!hasDates) {
    return (
      <div className="rounded-[var(--radius-lg)] border border-dashed border-line p-5 text-sm text-muted">
        {priced
          ? 'Válassz dátumot, és megmutatjuk a tájékoztató végösszeget.'
          : 'Az árat egyedi ajánlatban küldjük: válassz dátumot a foglalási kérelemhez, vagy kérj ajánlatot.'}
        {!listing.singleNightAllowed && <> Minimum {listing.minNights} éjszaka.</>}
      </div>
    )
  }
  if (loading && !quote) return <div className="rounded-[var(--radius-lg)] border border-line p-5 text-sm text-muted" aria-live="polite">Ellenőrzés…</div>
  if (!quote) return null
  if (!quote.valid) {
    return (
      <div className="rounded-[var(--radius-lg)] border border-clay/40 bg-clay/10 p-5" role="status">
        <p className="text-sm text-ink/90">{humanError(quote.reason, listing.minNights)}</p>
      </div>
    )
  }
  if (quote.total == null) {
    return (
      <div className="rounded-[var(--radius-lg)] border border-line bg-paper/60 p-5" role="status">
        <div className="flex items-baseline justify-between">
          <span className="label-caps">{mode === 'book' ? 'Foglalható' : 'Ajánlatkérés'}</span>
          <span className="text-sm text-muted tnum">{quote.nights} éj</span>
        </div>
        <p className="mt-2 text-sm text-ink/85">A dátumok szabadok. Az árat a visszaigazolással együtt küldjük el.</p>
      </div>
    )
  }
  const nightly = quote.nights && quote.subtotal != null ? Math.round(quote.subtotal / quote.nights) : null
  return (
    <div className="rounded-[var(--radius-lg)] border border-line bg-paper/60 p-5" role="status">
      <div className="flex items-baseline justify-between">
        <div className="label-caps">Tájékoztató ár</div>
        <div className="text-sm text-muted tnum">{quote.nights} éj</div>
      </div>
      <dl className="mt-3 space-y-1.5 text-sm">
        <Row dt={<span className="tnum">{quote.nights} éj × {formatHuf(nightly)}</span>} dd={<span className="tnum">{formatHuf(quote.subtotal)}</span>} />
        {quote.surcharges.map((s) => <Row key={s.code} dt={s.label} dd={<span className="tnum">+{formatHuf(s.amount)}</span>} />)}
      </dl>
      <div className="mt-3 flex items-baseline justify-between border-t border-line pt-3">
        <span className="font-display text-lg">Végösszeg</span>
        <span className="font-display text-2xl tnum text-deep">{formatHuf(quote.total)}</span>
      </div>
    </div>
  )
}

function Row({ dt, dd }: { dt: React.ReactNode; dd: React.ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-4">
      <dt className="text-ink/80">{dt}</dt>
      <dd className="font-medium">{dd}</dd>
    </div>
  )
}

function Stepper({ value, min, max, onChange, labelledBy }: { value: number; min: number; max: number; onChange: (n: number) => void; labelledBy: string }) {
  return (
    <div className="inline-flex items-center gap-1 rounded-full border border-line bg-cream p-1" role="group" aria-labelledby={labelledBy}>
      <button type="button" aria-label="Kevesebb fő" className="btn btn-ghost !h-11 !min-h-11 !w-11 !border-0 !p-0" onClick={() => onChange(Math.max(min, value - 1))} disabled={value <= min}>−</button>
      <span className="w-8 text-center font-semibold tnum" aria-live="polite">{value}</span>
      <button type="button" aria-label="Több fő" className="btn btn-ghost !h-11 !min-h-11 !w-11 !border-0 !p-0" onClick={() => onChange(Math.min(max, value + 1))} disabled={value >= max}>+</button>
    </div>
  )
}

function Toggle({ checked, onChange, label }: { checked: boolean; onChange: (b: boolean) => void; label: string }) {
  return (
    <label className="flex min-h-11 cursor-pointer items-center gap-3 text-sm">
      <input type="checkbox" className="peer sr-only" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      <span aria-hidden="true" className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-water ${checked ? 'bg-action' : 'bg-line'}`}>
        <span className={`inline-block h-5 w-5 rounded-full bg-cream transition-transform ${checked ? 'translate-x-5' : 'translate-x-0.5'}`} />
      </span>
      <span>{label}</span>
    </label>
  )
}
