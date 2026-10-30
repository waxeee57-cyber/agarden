'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { Calendar, addDays, parseISO, toISO, fmtDay } from './Calendar'
import { formatHuf } from '@/lib/format'
import { telHref } from '@/lib/brand'

// Step-by-step booking for the CURRENT host's house ("hülyebiztos"):
//   1 Dátum → 2 Létszám, extrák → 3 Adataid → 4 Összegzés → küldés → kész.
// One decision per step, errors next to the field, 48 px targets, and the
// phone number is one tap away on every step. The client never sends a
// listing id: every /api route resolves the house from the request host.

export type WidgetListing = {
  siteName: string
  capacityMax: number
  capacityExtra: number
  minNights: number
  pricingMode: 'fixed' | 'quote' | 'demo'
  phone: string
  email: string | null
  singleNightAllowed: boolean
  confirmHours: number | null
  depositLine: string | null
  extraCosts: string[]
}
export type SisterInfo = { name: string; origin: string; pitch: string }

type Quote = { valid: boolean; reason: string | null; nights: number; subtotal: number | null; surcharges: { code: string; label: string; amount: number }[]; total: number | null; pricingMode: string | null }

function humanError(code: string | null | undefined, minNights: number): string {
  switch (code) {
    case 'overlap': return 'Ez az időszak közben foglalt lett. Válassz másik dátumot.'
    case 'min_nights': return `Legalább ${minNights} éjszaka foglalható. Rövidebb tartózkodáshoz kérj ajánlatot.`
    case 'invalid_dates': return 'A távozás legyen későbbi az érkezésnél.'
    case 'capacity_unavailable': return 'Ennyi főre a ház nem foglalható. Kérj ajánlatot, és egyeztetünk.'
    case 'listing_not_found': return 'A ház jelenleg nem foglalható online. Hívj minket.'
    case 'validation_error': return 'Ellenőrizd a megadott adatokat.'
    case 'rate_limited': return 'Túl sok próbálkozás. Várj pár percet, vagy hívj minket.'
    default: return 'Nem sikerült elküldeni. Próbáld újra, vagy hívj minket.'
  }
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const ISO_RE = /^\d{4}-\d{2}-\d{2}$/
const STEPS = ['Dátum', 'Létszám', 'Adataid', 'Összegzés'] as const

export function BookingWidget({ listing, sister }: { listing: WidgetListing; sister: SisterInfo }) {
  const maxGuests = listing.capacityMax + listing.capacityExtra
  const params = useSearchParams()
  const initIn = params.get('checkIn')
  const initOut = params.get('checkOut')
  const valid = (s: string | null) => !!s && ISO_RE.test(s) && s >= toISO(new Date())

  const [step, setStep] = useState(0)
  const [mode, setMode] = useState<'book' | 'inquiry'>(params.get('ajanlat') === '1' ? 'inquiry' : 'book')
  const [checkIn, setCheckIn] = useState<string | null>(valid(initIn) ? initIn : null)
  const [checkOut, setCheckOut] = useState<string | null>(valid(initIn) && valid(initOut) && initOut! > initIn! ? initOut : null)
  const [guests, setGuests] = useState(Math.min(4, maxGuests))
  const [pet, setPet] = useState(false)
  const [isEvent, setIsEvent] = useState(params.get('rendezveny') === '1')
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
  const top = useRef<HTMLDivElement>(null)

  const debounce = useRef<ReturnType<typeof setTimeout> | null>(null)
  useEffect(() => {
    if (debounce.current) clearTimeout(debounce.current)
    debounce.current = setTimeout(async () => {
      if (!checkIn || !checkOut) { setQuote(null); return }
      setQuoteLoading(true)
      try {
        const res = await fetch('/api/quote', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ checkIn, checkOut, guests, pet, isEvent }) })
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

  function go(n: number) {
    setStep(n)
    setSubmitError(null)
    // keep the step heading in view on phones, and move focus to it for screen readers
    requestAnimationFrame(() => {
      top.current?.scrollIntoView({ block: 'start', behavior: 'smooth' })
      top.current?.querySelector<HTMLElement>('[data-step-title]')?.focus()
    })
  }

  function validateStep(s: number): boolean {
    const e: Record<string, string> = {}
    if (s === 0 && mode === 'book') {
      if (!checkIn || !checkOut) e.dates = 'Válaszd ki az érkezés és a távozás napját a naptárban.'
      else if (quote && !quote.valid) e.dates = humanError(quote.reason, listing.minNights)
    }
    if (s === 1 && (guests < 1 || guests > maxGuests)) e.guests = `1 és ${maxGuests} fő között.`
    if (s === 2) {
      if (name.trim().length < 2) e.name = 'Add meg a neved.'
      if (!EMAIL_RE.test(email.trim())) e.email = 'Érvényes e-mail cím kell, ide küldjük a visszaigazolást.'
      if (phone.trim() && phone.trim().replace(/\D/g, '').length < 6) e.phone = 'Ellenőrizd a telefonszámot.'
    }
    setErrors(e)
    return !Object.keys(e).length
  }

  const next = () => { if (validateStep(step)) go(step + 1) }

  async function submit() {
    if (![0, 1, 2].every((s) => validateStep(s))) {
      const first = [0, 1, 2].find((s) => !validateStep(s))
      if (first != null) go(first)
      return
    }
    setSubmitting(true)
    setSubmitError(null)
    const contact = { guestName: name.trim(), guestEmail: email.trim(), ...(phone.trim() ? { guestPhone: phone.trim() } : {}), ...(message.trim() ? { message: message.trim() } : {}) }
    try {
      const res = await fetch(mode === 'book' ? '/api/booking' : '/api/quote-request', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(mode === 'book'
          ? { checkIn, checkOut, guests, pet, isEvent, ...contact }
          : { ...(checkIn ? { checkIn } : {}), ...(checkOut ? { checkOut } : {}), guests, pet, isEvent, ...contact }),
      })
      const data = await res.json()
      if (data.ok) {
        setSuccess({ kind: mode, id: data.bookingId, total: data.total })
        requestAnimationFrame(() => top.current?.scrollIntoView({ block: 'start' }))
      } else {
        setSubmitError(humanError(data.reason, listing.minNights))
        if (data.reason === 'overlap' && checkIn && checkOut) void checkSister(checkIn, checkOut)
      }
    } catch {
      setSubmitError(humanError('unknown', listing.minNights))
    } finally {
      setSubmitting(false)
    }
  }

  const callBtn = (
    <a href={telHref(listing.phone)} className="btn btn-line btn-sm shrink-0">
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.1 4.2 2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1.9.4 1.8.7 2.7a2 2 0 0 1-.5 2.1L8 9.8a16 16 0 0 0 6 6l1.3-1.3a2 2 0 0 1 2.1-.4c.9.3 1.8.6 2.7.7a2 2 0 0 1 1.7 2z" /></svg>
      Inkább felhívlak
    </a>
  )

  if (success) {
    return (
      <div ref={top} className="panel scroll-mt-4 p-6 md:p-10" role="status">
        <span className="flex h-14 w-14 items-center justify-center rounded-full bg-act text-act-fg" aria-hidden="true">
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><path d="M4 12.5 9.5 18 20 6" /></svg>
        </span>
        <h2 className="mt-5 text-[clamp(1.8rem,4vw,2.6rem)]">{success.kind === 'book' ? 'Megkaptuk a foglalási kérelmed!' : 'Megkaptuk az ajánlatkérésed!'}</h2>
        <ol className="mt-6 grid gap-3 text-fg/90">
          <li><strong>Most:</strong> {success.kind === 'book' ? 'a dátumokat fenntartjuk neked. Pénzt nem vontunk le.' : 'az ajánlatkérés még nem foglal le dátumot.'}</li>
          <li><strong>{listing.confirmHours ? `${listing.confirmHours} órán belül:` : 'Hamarosan:'}</strong> {success.kind === 'book' ? 'e-mailben visszaigazoljuk a foglalást' : 'e-mailben vagy telefonon küldjük az ajánlatot'} ({email.trim()}).</li>
          {success.kind === 'book' && listing.depositLine && <li><strong>Utána:</strong> {listing.depositLine} A számlaszámot a visszaigazoló levélben küldjük.</li>}
        </ol>
        <dl className="mt-6 space-y-1 text-sm">
          {success.id && <Row dt="Azonosító" dd={<span className="tnum">{success.id.slice(0, 8)}</span>} />}
          {checkIn && checkOut && <Row dt="Dátum" dd={`${fmtDay(parseISO(checkIn))} – ${fmtDay(parseISO(checkOut))}`} />}
          {success.kind === 'book' && success.total != null && <Row dt="Tájékoztató végösszeg" dd={<span className="tnum">{formatHuf(success.total)}</span>} />}
        </dl>
        <div className="mt-8 flex flex-wrap gap-3">
          <Link href="/" className="btn btn-act">Vissza a főoldalra</Link>
          <a href={telHref(listing.phone)} className="btn btn-line">Kérdésem van: {listing.phone}</a>
        </div>
      </div>
    )
  }

  return (
    <div ref={top} className="panel scroll-mt-4 overflow-hidden">
      {/* progress + call: always visible */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-rule px-5 py-4 md:px-8">
        <ol className="flex gap-1.5" aria-label="Lépések">
          {STEPS.map((s, i) => (
            <li key={s} aria-current={i === step ? 'step' : undefined} className={`h-1.5 w-8 rounded-full md:w-12 ${i <= step ? 'bg-act' : 'bg-rule'}`}>
              <span className="sr-only">{i + 1}. {s}{i < step ? ' (kész)' : ''}</span>
            </li>
          ))}
        </ol>
        {callBtn}
      </div>

      <div className="p-5 md:p-8">
        <p className="text-sm font-semibold text-soft">{step + 1}. lépés a {STEPS.length}-ből</p>

        {step === 0 && (
          <section aria-labelledby="st-0">
            <h2 id="st-0" data-step-title tabIndex={-1} className="mt-1 text-[clamp(1.6rem,3.4vw,2.2rem)] outline-none">Mikor jönnétek?</h2>
            <p className="mb-4 mt-2 text-soft">Koppints az érkezés, majd a távozás napjára. Minimum {listing.minNights} éjszaka; a távozás napja másnak már érkezési nap lehet.</p>
            <Calendar
              checkIn={checkIn}
              checkOut={checkOut}
              contact={{ phone: listing.phone, email: listing.email }}
              onBlockedPick={(d) => void checkSister(d, toISO(addDays(parseISO(d), Math.max(listing.minNights, 1))))}
              onSelect={(ci, co) => { setCheckIn(ci); setCheckOut(co); setSisterOffer(null); setMode('book'); setErrors((e) => ({ ...e, dates: '' })) }}
            />
            {errors.dates && <p className="err mt-3" role="alert">{errors.dates}</p>}
            {checkIn && checkOut && <DatesSummary checkIn={checkIn} checkOut={checkOut} quote={quote} loading={quoteLoading} minNights={listing.minNights} />}
            {sisterOffer && <SisterBox offer={sisterOffer} sister={sister} />}
            <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center">
              <button type="button" className="btn btn-act" onClick={next}>Tovább: létszám</button>
              <button type="button" className="btn btn-line" onClick={() => { setMode('inquiry'); setCheckIn(null); setCheckOut(null); setErrors({}); go(1) }}>
                Még nincs pontos dátum: ajánlatot kérek
              </button>
            </div>
          </section>
        )}

        {step === 1 && (
          <section aria-labelledby="st-1">
            <h2 id="st-1" data-step-title tabIndex={-1} className="mt-1 text-[clamp(1.6rem,3.4vw,2.2rem)] outline-none">Hányan lesztek?</h2>
            <p className="mt-2 text-soft">Legfeljebb {listing.capacityMax}+{listing.capacityExtra} fő (a +{listing.capacityExtra} pótágyon).</p>
            <div className="mt-5 flex items-center gap-4">
              <Stepper value={guests} min={1} max={maxGuests} onChange={setGuests} label="Létszám" />
              <span className="text-lg font-semibold tnum">{guests} fő</span>
            </div>
            {errors.guests && <p className="err mt-2">{errors.guests}</p>}
            <fieldset className="mt-8">
              <legend className="field-label">Extrák</legend>
              <div className="mt-2 grid gap-2">
                <Toggle checked={pet} onChange={setPet} label="Kistestű kisállatot hozunk" hint="felár ellenében" />
                <Toggle checked={isEvent} onChange={setIsEvent} label="Rendezvény, legény- vagy lánybúcsú" hint="eltérő ár, egyeztetéssel" />
              </div>
            </fieldset>
            <Nav onBack={() => go(0)} onNext={next} nextLabel="Tovább: adataid" />
          </section>
        )}

        {step === 2 && (
          <section aria-labelledby="st-2">
            <h2 id="st-2" data-step-title tabIndex={-1} className="mt-1 text-[clamp(1.6rem,3.4vw,2.2rem)] outline-none">Kinek küldjük a visszaigazolást?</h2>
            <div className="mt-5 grid gap-4">
              <Field id="bw-name" label="Név" value={name} onChange={setName} error={errors.name} autoComplete="name" />
              <div className="grid gap-4 sm:grid-cols-2">
                <Field id="bw-email" label="E-mail" type="email" inputMode="email" value={email} onChange={setEmail} error={errors.email} autoComplete="email" />
                <Field id="bw-phone" label="Telefon" optional type="tel" inputMode="tel" value={phone} onChange={setPhone} error={errors.phone} autoComplete="tel" />
              </div>
              <div className="field">
                <label htmlFor="bw-msg">Üzenet <span className="font-normal text-soft">(nem kötelező)</span></label>
                <textarea id="bw-msg" className="input" rows={3} value={message} onChange={(e) => setMessage(e.target.value)} placeholder={mode === 'book' ? 'Pl. mikor érkeztek, kérdés a házról' : 'Pl. melyik hétvége, hány éjszaka, mire készültök'} />
              </div>
            </div>
            <Nav onBack={() => go(1)} onNext={next} nextLabel="Tovább: összegzés" />
          </section>
        )}

        {step === 3 && (
          <section aria-labelledby="st-3">
            <h2 id="st-3" data-step-title tabIndex={-1} className="mt-1 text-[clamp(1.6rem,3.4vw,2.2rem)] outline-none">Minden stimmel?</h2>
            <dl className="mt-5 divide-y divide-rule border-y border-rule">
              <SummaryRow dt="Típus" dd={mode === 'book' ? 'Foglalási kérelem' : 'Ajánlatkérés (nem foglal le dátumot)'} onEdit={() => go(0)} />
              <SummaryRow dt="Dátum" dd={checkIn && checkOut ? `${fmtDay(parseISO(checkIn))} – ${fmtDay(parseISO(checkOut))}${quote?.nights ? ` (${quote.nights} éj)` : ''}` : 'Még nincs pontos dátum'} onEdit={() => go(0)} />
              <SummaryRow dt="Létszám" dd={`${guests} fő${pet ? ', kisállattal' : ''}${isEvent ? ', rendezvény' : ''}`} onEdit={() => go(1)} />
              <SummaryRow dt="Kapcsolat" dd={`${name.trim()}, ${email.trim()}${phone.trim() ? `, ${phone.trim()}` : ''}`} onEdit={() => go(2)} />
              <SummaryRow dt="Ár" dd={quote?.valid && quote.total != null ? `${formatHuf(quote.total)} (tájékoztató)` : 'Egyedi ajánlatban küldjük'} />
            </dl>
            <ul className="mt-5 grid gap-1.5 text-sm text-soft">
              <li>Most nem vonunk le pénzt, online fizetés nincs.</li>
              {mode === 'book' && listing.depositLine && <li>{listing.depositLine}</li>}
              {listing.extraCosts.map((x) => <li key={x}>{x}</li>)}
            </ul>
            {submitError && <p className="err mt-4" role="alert">{submitError}</p>}
            {sisterOffer && <SisterBox offer={sisterOffer} sister={sister} />}
            <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:items-center">
              <button type="button" className="btn btn-line" onClick={() => go(2)}>Vissza</button>
              <button type="button" className="btn btn-act sm:min-w-64" onClick={submit} disabled={submitting}>
                {submitting ? 'Küldés…' : mode === 'book' ? 'Foglalási kérelem elküldése' : 'Ajánlatkérés elküldése'}
              </button>
            </div>
            <p className="mt-4 text-xs text-soft">
              A küldéssel elfogadod az <Link href="/aszf" className="underline underline-offset-2">ÁSZF</Link>-et. Az adataidat csak a kérés intézéséhez használjuk:{' '}
              <Link href="/adatvedelem" className="underline underline-offset-2">Adatvédelem</Link>.
            </p>
          </section>
        )}
      </div>
    </div>
  )
}

function DatesSummary({ checkIn, checkOut, quote, loading, minNights }: { checkIn: string; checkOut: string; quote: Quote | null; loading: boolean; minNights: number }) {
  return (
    <div className="mt-4 rounded-[var(--radius-lg)] border border-rule bg-surface-2 p-4" aria-live="polite">
      <p className="font-semibold">{fmtDay(parseISO(checkIn))} – {fmtDay(parseISO(checkOut))}{quote?.nights ? <span className="font-normal text-soft"> · {quote.nights} éj</span> : null}</p>
      {loading && !quote ? <p className="mt-1 text-sm text-soft">Ellenőrzés…</p>
        : quote && !quote.valid ? <p className="err mt-1">{humanError(quote.reason, minNights)}</p>
        : quote?.total != null ? <p className="mt-1 text-sm">Tájékoztató ár: <strong className="tnum">{formatHuf(quote.total)}</strong></p>
        : quote ? <p className="mt-1 text-sm text-soft">Szabad. Az árat a visszaigazolással küldjük.</p> : null}
    </div>
  )
}

function SisterBox({ offer, sister }: { offer: { href: string; from: string; to: string }; sister: SisterInfo }) {
  return (
    <div className="mt-4 rounded-[var(--radius-lg)] border border-act/40 bg-range p-4" role="status">
      <p className="font-semibold">Ezek a napok nálunk foglaltak, de a testvérházunk szabad: {fmtDay(parseISO(offer.from))} – {fmtDay(parseISO(offer.to))}</p>
      {sister.pitch && <p className="mt-1 text-sm text-fg/85">{sister.pitch}</p>}
      <a href={offer.href} className="btn btn-act btn-sm mt-3">Megnézem: {sister.name}</a>
    </div>
  )
}

function Nav({ onBack, onNext, nextLabel }: { onBack: () => void; onNext: () => void; nextLabel: string }) {
  return (
    <div className="mt-8 flex flex-col-reverse gap-3 sm:flex-row sm:items-center">
      <button type="button" className="btn btn-line" onClick={onBack}>Vissza</button>
      <button type="button" className="btn btn-act" onClick={onNext}>{nextLabel}</button>
    </div>
  )
}

function Field({ id, label, value, onChange, error, optional, ...rest }: { id: string; label: string; value: string; onChange: (v: string) => void; error?: string; optional?: boolean } & Omit<React.InputHTMLAttributes<HTMLInputElement>, 'onChange' | 'value' | 'id'>) {
  return (
    <div className="field">
      <label htmlFor={id}>{label}{optional && <span className="font-normal text-soft"> (nem kötelező)</span>}</label>
      <input id={id} className="input" value={value} onChange={(e) => onChange(e.target.value)} aria-invalid={!!error} aria-describedby={error ? `${id}-err` : undefined} {...rest} />
      {error && <p id={`${id}-err`} className="err">{error}</p>}
    </div>
  )
}

function SummaryRow({ dt, dd, onEdit }: { dt: string; dd: string; onEdit?: () => void }) {
  return (
    <div className="flex items-start justify-between gap-4 py-3">
      <div>
        <dt className="text-xs font-semibold uppercase tracking-[0.14em] text-soft">{dt}</dt>
        <dd className="mt-1 font-semibold">{dd}</dd>
      </div>
      {onEdit && <button type="button" onClick={onEdit} className="min-h-12 shrink-0 px-2 text-sm font-semibold text-pop underline underline-offset-4">Módosítom</button>}
    </div>
  )
}

function Row({ dt, dd }: { dt: React.ReactNode; dd: React.ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-4">
      <dt className="text-fg/85">{dt}</dt>
      <dd className="font-medium">{dd}</dd>
    </div>
  )
}

function Stepper({ value, min, max, onChange, label }: { value: number; min: number; max: number; onChange: (n: number) => void; label: string }) {
  return (
    <div className="inline-flex items-center gap-1 rounded-full border border-rule bg-surface p-1" role="group" aria-label={label}>
      <button type="button" aria-label="Kevesebb fő" className="btn btn-line !h-12 !min-h-12 !w-12 !border-0 !p-0 text-xl" onClick={() => onChange(Math.max(min, value - 1))} disabled={value <= min}>−</button>
      <span className="w-10 text-center text-lg font-semibold tnum" aria-live="polite">{value}</span>
      <button type="button" aria-label="Több fő" className="btn btn-line !h-12 !min-h-12 !w-12 !border-0 !p-0 text-xl" onClick={() => onChange(Math.min(max, value + 1))} disabled={value >= max}>+</button>
    </div>
  )
}

function Toggle({ checked, onChange, label, hint }: { checked: boolean; onChange: (b: boolean) => void; label: string; hint?: string }) {
  return (
    <label className="flex min-h-12 cursor-pointer items-center gap-3 rounded-[var(--radius-md)] border border-rule bg-surface px-4 py-2">
      <input type="checkbox" className="peer sr-only" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      <span aria-hidden="true" className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-focus ${checked ? 'bg-act' : 'bg-rule'}`}>
        <span className={`inline-block h-5 w-5 rounded-full border border-rule bg-surface transition-transform ${checked ? 'translate-x-5' : 'translate-x-0.5'}`} />
      </span>
      <span><span className="font-semibold">{label}</span>{hint && <span className="block text-sm text-soft">{hint}</span>}</span>
    </label>
  )
}
