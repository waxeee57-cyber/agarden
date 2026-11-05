'use client'

import { useEffect, useRef, useState } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { createPortal } from 'react-dom'
import { Calendar, addDays, parseISO, toISO, fmtDay, fmtShort } from './Calendar'
import { formatHuf } from '@/lib/format'
import { telHref } from '@/lib/brand'

// Booking for the CURRENT host's house. Two steps, modern booking-engine
// layout: (1) dates + guests + extras, (2) contact + send. A sticky
// reservation card (desktop) / bottom bar (phone) always shows what is
// picked, the price or "egyedi ajánlat", and the one next action.
// The client never sends a listing id: every /api route resolves the house
// from the request host.

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
  cover: { url: string; alt: string } | null
  address: string | null
}
export type SisterInfo = { name: string; origin: string; pitch: string }

type Quote = { valid: boolean; reason: string | null; nights: number; subtotal: number | null; surcharges: { code: string; label: string; amount: number }[]; total: number | null; pricingMode: string | null }

function humanError(code: string | null | undefined, minNights: number): string {
  switch (code) {
    case 'overlap': return 'Ez az időszak közben foglalt lett. Kérjük, válasszon másik dátumot.'
    case 'min_nights': return `Legalább ${minNights} éjszaka foglalható. Rövidebb tartózkodáshoz kérjen ajánlatot.`
    case 'invalid_dates': return 'A távozás legyen későbbi az érkezésnél.'
    case 'capacity_unavailable': return 'Ennyi főre a ház nem foglalható. Kérjen ajánlatot, és egyeztetünk.'
    case 'listing_not_found': return 'A ház jelenleg nem foglalható online. Kérjük, hívjon minket.'
    case 'validation_error': return 'Kérjük, ellenőrizze a megadott adatokat.'
    case 'rate_limited': return 'Túl sok próbálkozás. Kérjük, várjon pár percet, vagy hívjon minket.'
    default: return 'Nem sikerült elküldeni. Kérjük, próbálja újra, vagy hívjon minket.'
  }
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const ISO_RE = /^\d{4}-\d{2}-\d{2}$/
const STEPS = ['Időpont és vendégek', 'Adatok és küldés'] as const
const shortDay = (iso: string) => fmtDay(parseISO(iso))

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
  const [adults, setAdults] = useState(Math.min(4, maxGuests))
  const [children, setChildren] = useState(0)
  const guests = adults + children
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

  // room for the fixed bottom bar on phones, so it never covers the footer;
  // the bar is portalled to <body> because page sections use content-visibility
  // (contain: paint), which would trap position:fixed inside the section
  const [portal, setPortal] = useState<{ el: HTMLElement; skin: string | null } | null>(null)
  const barShown = !success
  useEffect(() => {
    if (!barShown) return
    document.body.classList.add('has-bookbar')
    setPortal({ el: document.body, skin: top.current?.closest('[data-skin]')?.getAttribute('data-skin') ?? null })
    return () => document.body.classList.remove('has-bookbar')
  }, [barShown])

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
    }, 250)
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
    requestAnimationFrame(() => {
      top.current?.scrollIntoView({ block: 'start', behavior: 'smooth' })
      top.current?.querySelector<HTMLElement>('[data-step-title]')?.focus({ preventScroll: true })
    })
  }

  function validateStep(s: number): boolean {
    const e: Record<string, string> = {}
    if (s === 0) {
      if (mode === 'book') {
        if (!checkIn || !checkOut) e.dates = 'Válassza ki az érkezés és a távozás napját a naptárban.'
        else if (quote && !quote.valid) e.dates = humanError(quote.reason, listing.minNights)
      }
      if (guests < 1 || guests > maxGuests) e.guests = `1 és ${maxGuests} fő között.`
    }
    if (s === 1) {
      if (name.trim().length < 2) e.name = 'Kérjük, adja meg a nevét.'
      if (!EMAIL_RE.test(email.trim())) e.email = 'Érvényes e-mail cím kell, ide küldjük a visszaigazolást.'
      if (phone.trim() && phone.trim().replace(/\D/g, '').length < 6) e.phone = 'Kérjük, ellenőrizze a telefonszámot.'
    }
    setErrors(e)
    return !Object.keys(e).length
  }

  const next = () => { if (validateStep(0)) go(1) }

  async function submit() {
    if (!validateStep(0)) { go(0); return }
    if (!validateStep(1)) return
    setSubmitting(true)
    setSubmitError(null)
    const contact = { guestName: name.trim(), guestEmail: email.trim(), ...(phone.trim() ? { guestPhone: phone.trim() } : {}), ...(message.trim() ? { message: message.trim() } : {}) }
    try {
      const res = await fetch(mode === 'book' ? '/api/booking' : '/api/quote-request', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(mode === 'book'
          ? { checkIn, checkOut, guests, children, pet, isEvent, ...contact }
          : { ...(checkIn ? { checkIn } : {}), ...(checkOut ? { checkOut } : {}), guests, children, pet, isEvent, ...contact }),
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

  const nights = quote?.nights || (checkIn && checkOut ? Math.round((parseISO(checkOut).getTime() - parseISO(checkIn).getTime()) / 86_400_000) : 0)
  const hasDates = !!(checkIn && checkOut)
  const priced = !!(quote?.valid && quote.total != null)
  const datesInvalid = !!(quote && hasDates && !quote.valid)
  const primary = step === 0
    ? { label: mode === 'inquiry' ? 'Tovább az adatokhoz' : 'Tovább', onClick: next, disabled: false }
    : { label: submitting ? 'Küldés…' : mode === 'book' ? 'Foglalási kérelem elküldése' : 'Ajánlatkérés elküldése', onClick: submit, disabled: submitting }

  if (success) {
    const code = success.id ? success.id.slice(0, 8).toUpperCase() : null
    return (
      <div ref={top} className="bk-step mx-auto max-w-2xl scroll-mt-24 rounded-[var(--radius-xl)] border border-rule bg-surface p-7 text-center shadow-[0_30px_80px_-50px_rgb(20_24_22/0.5)] md:p-12" role="status">
        <span className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-sel text-sel-fg" aria-hidden="true">
          <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 12.5 9.5 18 20 6" /></svg>
        </span>
        <h2 className="mt-6 text-[clamp(1.9rem,4vw,2.6rem)]">{success.kind === 'book' ? 'Megkaptuk foglalási kérelmét' : 'Megkaptuk ajánlatkérését'}</h2>
        <p className="mx-auto mt-3 max-w-[46ch] text-soft">
          {success.kind === 'book' ? 'A dátumokat fenntartjuk Önnek, pénzt nem vontunk le.' : 'Az ajánlatkérés még nem foglal le dátumot.'}{' '}
          {listing.confirmHours ? `${listing.confirmHours} órán belül` : 'Hamarosan'} {success.kind === 'book' ? 'e-mailben visszaigazoljuk' : 'e-mailben vagy telefonon küldjük az ajánlatot'}: <strong className="text-fg">{email.trim()}</strong>
        </p>
        {code && <CodeBox code={code} />}
        <dl className="mx-auto mt-6 max-w-sm divide-y divide-rule rounded-[var(--radius-lg)] border border-rule text-left text-sm">
          {checkIn && checkOut && <Line dt="Időpont" dd={`${fmtDay(parseISO(checkIn))} – ${fmtDay(parseISO(checkOut))}`} />}
          <Line dt="Vendégek" dd={children ? `${adults} felnőtt + ${children} gyerek` : `${guests} fő`} />
          {success.kind === 'book' && success.total != null && <Line dt="Tájékoztató végösszeg" dd={<span className="tnum">{formatHuf(success.total)}</span>} />}
        </dl>
        {success.kind === 'book' && listing.depositLine && <p className="mx-auto mt-5 max-w-[46ch] text-sm text-soft">{listing.depositLine} A számlaszámot a visszaigazoló levélben küldjük.</p>}
        <div className="mx-auto mt-8 grid max-w-sm gap-3 sm:flex sm:max-w-none sm:flex-wrap sm:justify-center">
          {success.kind === 'book' && checkIn && checkOut && (
            <a href={`/api/ics?checkIn=${checkIn}&checkOut=${checkOut}${code ? `&kod=${code}` : ''}`} className="btn btn-act">Naptárba mentés</a>
          )}
          {code && <Link href={`/foglalasom?kod=${code}`} className="btn btn-line">Foglalásom</Link>}
          <Link href="/" className="btn btn-line">Főoldal</Link>
        </div>
        <p className="mt-6 text-sm text-soft">Kérdése van? <a href={telHref(listing.phone)} className="font-semibold text-fg underline underline-offset-2">{listing.phone}</a></p>
      </div>
    )
  }

  return (
    <div ref={top} className="scroll-mt-24">
      {/* step header */}
      <ol className="mb-8 flex items-center gap-3 text-sm" aria-label="Lépések">
        {STEPS.map((s, i) => (
          <li key={s} className="flex items-center gap-3" aria-current={i === step ? 'step' : undefined}>
            {i > 0 && <span aria-hidden="true" className={`h-px w-8 md:w-14 ${step >= i ? 'bg-fg' : 'bg-rule'}`} />}
            <button
              type="button"
              disabled={i > step}
              onClick={() => i < step && go(i)}
              className={`flex items-center gap-2.5 font-semibold ${i === step ? 'text-fg' : i < step ? 'text-fg/70 hover:text-fg' : 'text-soft'}`}
            >
              <span className={`flex h-7 w-7 items-center justify-center rounded-full text-[0.8rem] tnum ${i < step ? 'bg-sel text-sel-fg' : i === step ? 'bg-fg text-bg' : 'border border-rule text-soft'}`}>
                {i < step ? <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M4 12.5 9.5 18 20 6" /></svg> : i + 1}
              </span>
              <span className={i === step ? '' : 'hidden sm:inline'}>{s}</span>
            </button>
          </li>
        ))}
      </ol>

      <div className="grid items-start gap-8 lg:grid-cols-[minmax(0,1fr)_380px] lg:gap-12">
        {/* ---------- main column ---------- */}
        <div className="min-w-0">
          {step === 0 && (
            <div key="s0" className="bk-step space-y-6">
              <Card>
                <div className="flex flex-wrap items-end justify-between gap-3">
                  <div>
                    <h2 id="st-0" data-step-title tabIndex={-1} className="text-[clamp(1.5rem,3vw,2rem)] outline-none">Mikor érkeznek?</h2>
                    <p className="mt-1 text-sm text-soft">Minimum {listing.minNights} éjszaka{listing.singleNightAllowed ? ', 1 éjszaka felárral' : ''}. A távozás napján új vendég már érkezhet.</p>
                  </div>
                  {mode === 'inquiry' && <span className="rounded-full bg-surface-2 px-3 py-1.5 text-xs font-semibold">Ajánlatkérés pontos dátum nélkül</span>}
                </div>

                <div className="mt-5 grid grid-cols-2 overflow-hidden rounded-[var(--radius-md)] border border-rule">
                  <DateBox label="Érkezés" value={checkIn ? shortDay(checkIn) : null} active={!checkIn} />
                  <DateBox label="Távozás" value={checkOut ? shortDay(checkOut) : null} active={!!checkIn && !checkOut} border />
                </div>

                <div className="mt-6">
                  <Calendar
                    checkIn={checkIn}
                    checkOut={checkOut}
                    contact={{ phone: listing.phone, email: listing.email }}
                    onBlockedPick={(d) => void checkSister(d, toISO(addDays(parseISO(d), Math.max(listing.minNights, 1))))}
                    onSelect={(ci, co) => { setCheckIn(ci); setCheckOut(co); setSisterOffer(null); if (ci) setMode('book'); setErrors((e) => ({ ...e, dates: '' })) }}
                  />
                </div>
                {(errors.dates || datesInvalid) && <p className="err mt-3" role="alert">{errors.dates || humanError(quote?.reason, listing.minNights)}</p>}
                {sisterOffer && <SisterBox offer={sisterOffer} sister={sister} />}
                {mode === 'book' && !hasDates && (
                  <button type="button" className="mt-4 min-h-11 text-sm font-semibold underline underline-offset-4 hover:text-pop" onClick={() => { setMode('inquiry'); setCheckIn(null); setCheckOut(null); setErrors({}) }}>
                    Még nincs pontos dátumunk: ajánlatot kérek
                  </button>
                )}
              </Card>

              <Card>
                <h3 className="text-[1.35rem]">Vendégek</h3>
                <p className="mt-0.5 text-sm text-soft">Legfeljebb {listing.capacityMax}+{listing.capacityExtra} fő{listing.capacityExtra ? ` (a +${listing.capacityExtra} pótágyon)` : ''}, gyerekekkel együtt.</p>
                <div className="mt-4 divide-y divide-rule border-y border-rule">
                  <div className="flex items-center justify-between gap-4 py-3.5">
                    <div><p className="font-semibold text-fg">Felnőttek</p><p className="text-sm text-soft">18 év felett</p></div>
                    <Stepper value={adults} min={1} max={maxGuests - children} onChange={setAdults} label="Felnőttek száma" unit="fő" />
                  </div>
                  <div className="flex items-center justify-between gap-4 py-3.5">
                    <div><p className="font-semibold text-fg">Gyerekek</p><p className="text-sm text-soft">0–17 év</p></div>
                    <Stepper value={children} min={0} max={maxGuests - adults} onChange={setChildren} label="Gyerekek száma" unit="fő" />
                  </div>
                </div>
                <p className="mt-3 text-sm text-soft" aria-live="polite">Összesen <strong className="text-fg">{guests} fő</strong>{guests >= maxGuests ? ' – ez a ház teljes kapacitása.' : '.'}</p>
                {errors.guests && <p className="err mt-2">{errors.guests}</p>}
              </Card>

              <Card>
                <h3 className="text-[1.35rem]">Extrák</h3>
                <div className="mt-4 grid gap-3 sm:grid-cols-2">
                  <Choice checked={pet} onChange={setPet} label="Kisállatot hozunk" hint="Kistestű, felár ellenében" icon={<path d="M8.4 9.6a1.9 1.9 0 1 0 0-3.8 1.9 1.9 0 0 0 0 3.8Zm7.2 0a1.9 1.9 0 1 0 0-3.8 1.9 1.9 0 0 0 0 3.8ZM5 13.6a1.7 1.7 0 1 0 0-3.4 1.7 1.7 0 0 0 0 3.4Zm14 0a1.7 1.7 0 1 0 0-3.4 1.7 1.7 0 0 0 0 3.4ZM12 12c-2.6 0-5 3.2-5 5.2 0 1.4 1.1 2 2.4 2 1 0 1.6-.5 2.6-.5s1.6.5 2.6.5c1.3 0 2.4-.6 2.4-2 0-2-2.4-5.2-5-5.2Z" />} />
                  <Choice checked={isEvent} onChange={setIsEvent} label="Rendezvény, búcsú" hint="Eltérő ár, egyeztetéssel" icon={<path d="M5 21 9.5 7.5l7 7L3 19m11-14 .5-2M18 9l2-.5M16 6l3-3M12.5 4.5 13 3m7 8 1.5-.5" />} />
                </div>
              </Card>

              <div className="hidden lg:flex lg:items-center lg:gap-5">
                <button type="button" className="btn btn-act min-w-56" onClick={next}>{primary.label}</button>
                <CallLink phone={listing.phone} />
              </div>
            </div>
          )}

          {step === 1 && (
            <div key="s1" className="bk-step space-y-6">
              <Card>
                <h2 id="st-1" data-step-title tabIndex={-1} className="text-[clamp(1.5rem,3vw,2rem)] outline-none">Kinek küldjük a visszaigazolást?</h2>
                <p className="mt-1 text-sm text-soft">Csak a kérés intézéséhez használjuk.</p>
                <div className="mt-6 grid gap-4">
                  <Field id="bw-name" label="Teljes név" value={name} onChange={setName} error={errors.name} autoComplete="name" />
                  <div className="grid gap-4 sm:grid-cols-2">
                    <Field id="bw-email" label="E-mail" type="email" inputMode="email" value={email} onChange={setEmail} error={errors.email} autoComplete="email" />
                    <Field id="bw-phone" label="Telefon" optional type="tel" inputMode="tel" value={phone} onChange={setPhone} error={errors.phone} autoComplete="tel" />
                  </div>
                  <div className="field">
                    <label htmlFor="bw-msg">Üzenet <span className="font-normal text-soft">(nem kötelező)</span></label>
                    <textarea id="bw-msg" className="input bk-input" rows={3} value={message} onChange={(e) => setMessage(e.target.value)} placeholder={mode === 'book' ? 'Pl. várható érkezés időpontja, kérdés a házról' : 'Pl. melyik hétvége, hány éjszaka, milyen alkalomra'} />
                  </div>
                </div>
              </Card>

              <ul className="grid gap-2 px-1 text-sm text-soft">
                <Note>Most nem vonunk le pénzt, online fizetés nincs.</Note>
                {mode === 'book' && listing.depositLine && <Note>{listing.depositLine}</Note>}
                {listing.extraCosts.map((x) => <Note key={x}>{x}</Note>)}
              </ul>

              {submitError && <p className="err" role="alert">{submitError}</p>}
              {sisterOffer && <SisterBox offer={sisterOffer} sister={sister} />}

              <div className="hidden lg:flex lg:items-center lg:gap-5">
                <button type="button" className="btn btn-act min-w-72" onClick={submit} disabled={submitting}>{primary.label}</button>
                <button type="button" className="min-h-11 text-sm font-semibold underline underline-offset-4" onClick={() => go(0)}>Vissza</button>
              </div>
              <p className="px-1 text-xs text-soft">
                A küldéssel elfogadja az <Link href="/aszf" className="underline underline-offset-2">ÁSZF</Link>-et és a <Link href="/hazirend" className="underline underline-offset-2">házirendet</Link>. Adatkezelés: <Link href="/adatvedelem" className="underline underline-offset-2">Adatvédelem</Link>.
              </p>
            </div>
          )}
        </div>

        {/* ---------- reservation card (desktop) ---------- */}
        <aside className="sticky top-24 hidden lg:block" aria-label="Foglalás összegzése">
          <div className="overflow-hidden rounded-[var(--radius-xl)] border border-rule bg-surface shadow-[0_30px_80px_-50px_rgb(20_24_22/0.55)]">
            {listing.cover && (
              <div className="relative aspect-[16/10] bg-surface-2">
                <Image src={listing.cover.url} alt={listing.cover.alt} fill sizes="380px" className="object-cover" />
                <div aria-hidden="true" className="absolute inset-0 bg-gradient-to-t from-[rgb(18_22_20/0.6)] via-transparent to-transparent" />
                <p className="absolute bottom-4 left-5 right-5 font-display text-[1.5rem] leading-tight text-[#FEFEFC]">{listing.siteName}</p>
              </div>
            )}
            <div className="p-6">
              {!listing.cover && <p className="mb-4 font-display text-[1.5rem] leading-tight">{listing.siteName}</p>}
              <Summary
                checkIn={checkIn} checkOut={checkOut} nights={nights} guests={guests} kids={children} pet={pet} isEvent={isEvent}
                quote={quote} loading={quoteLoading} priced={priced} mode={mode} step={step}
                onEdit={() => go(0)}
              />
              <button type="button" className="btn btn-act mt-6 w-full" onClick={primary.onClick} disabled={primary.disabled}>{primary.label}</button>
              <p className="mt-3 text-center text-xs text-soft">Most nem vonunk le pénzt</p>
            </div>
          </div>
          <div className="mt-4 flex justify-center"><CallLink phone={listing.phone} /></div>
        </aside>
      </div>

      <TrustRow confirmHours={listing.confirmHours} />

      {/* ---------- bottom bar (phone / tablet) ---------- */}
      {portal && createPortal(<div data-skin={portal.skin ?? undefined} className="fixed inset-x-0 bottom-0 z-40 border-t border-rule bg-surface/95 px-4 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-3 backdrop-blur lg:hidden">
        <div className="mx-auto flex max-w-3xl items-center justify-between gap-3">
          <div className="min-w-0 text-sm leading-tight">
            {priced ? <p className="font-semibold tnum">{formatHuf(quote!.total)}</p> : <p className="font-semibold">{hasDates ? 'Egyedi ajánlat' : mode === 'inquiry' ? 'Ajánlatkérés' : 'Válasszon dátumot'}</p>}
            <p className="truncate text-soft">{hasDates ? `${fmtShort(parseISO(checkIn!))} – ${fmtShort(parseISO(checkOut!))} · ${nights} éj · ${guests} fő` : `${guests} fő`}</p>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            {step === 1 && <button type="button" onClick={() => go(0)} aria-label="Vissza" className="flex h-12 w-12 items-center justify-center rounded-full border border-rule"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="m15 18-6-6 6-6" /></svg></button>}
            <button type="button" className="btn btn-act !px-5" onClick={primary.onClick} disabled={primary.disabled}>{step === 0 ? 'Tovább' : submitting ? 'Küldés…' : 'Elküldöm'}</button>
          </div>
        </div>
      </div>, portal.el)}
    </div>
  )
}

function Card({ children }: { children: React.ReactNode }) {
  return <section className="rounded-[var(--radius-xl)] border border-rule bg-surface p-5 md:p-7">{children}</section>
}

function DateBox({ label, value, active, border }: { label: string; value: string | null; active: boolean; border?: boolean }) {
  return (
    <div className={`px-4 py-3 ${border ? 'border-l border-rule' : ''} ${active ? 'bg-surface-2/70' : ''}`}>
      <p className="text-[0.66rem] font-bold uppercase tracking-[0.14em] text-soft">{label}</p>
      <p className={`mt-0.5 font-semibold ${value ? 'text-fg' : 'text-soft/80'}`}>{value ?? 'Dátum'}</p>
    </div>
  )
}

function Summary({ checkIn, checkOut, nights, guests, kids, pet, isEvent, quote, loading, priced, mode, step, onEdit }: {
  checkIn: string | null; checkOut: string | null; nights: number; guests: number; kids: number; pet: boolean; isEvent: boolean
  quote: Quote | null; loading: boolean; priced: boolean; mode: 'book' | 'inquiry'; step: number; onEdit: () => void
}) {
  const extras = [pet && 'kisállat', isEvent && 'rendezvény'].filter(Boolean).join(', ')
  return (
    <div aria-live="polite">
      <div className="grid grid-cols-2 overflow-hidden rounded-[var(--radius-md)] border border-rule text-sm">
        <div className="px-3 py-2.5"><p className="text-[0.62rem] font-bold uppercase tracking-[0.14em] text-soft">Érkezés</p><p className="mt-0.5 font-semibold">{checkIn ? fmtDay(parseISO(checkIn)) : '–'}</p></div>
        <div className="border-l border-rule px-3 py-2.5"><p className="text-[0.62rem] font-bold uppercase tracking-[0.14em] text-soft">Távozás</p><p className="mt-0.5 font-semibold">{checkOut ? fmtDay(parseISO(checkOut)) : '–'}</p></div>
        <div className="col-span-2 border-t border-rule px-3 py-2.5"><p className="text-[0.62rem] font-bold uppercase tracking-[0.14em] text-soft">Vendégek</p><p className="mt-0.5 font-semibold">{kids ? `${guests - kids} felnőtt + ${kids} gyerek` : `${guests} fő`}{extras ? <span className="font-normal text-soft"> · {extras}</span> : null}</p></div>
      </div>
      {step > 0 && <button type="button" onClick={onEdit} className="mt-2 min-h-9 text-sm font-semibold underline underline-offset-4 hover:text-pop">Módosítás</button>}

      <div className="mt-5 space-y-2 text-sm">
        {mode === 'inquiry' && !checkIn ? (
          <p className="text-soft">Ajánlatkérés: a pontos árat és a szabad időpontokat e-mailben küldjük.</p>
        ) : !checkIn || !checkOut ? (
          <p className="text-soft">Válassza ki az érkezést és a távozást az árhoz.</p>
        ) : loading && !quote ? (
          <p className="text-soft">Ár számítása…</p>
        ) : priced ? (
          <>
            {quote!.subtotal != null && <SumRow k={`Szállásdíj, ${nights} éjszaka`} v={formatHuf(quote!.subtotal)} />}
            {quote!.surcharges.map((s) => <SumRow key={s.code} k={s.label} v={formatHuf(s.amount)} />)}
            <div className="flex items-baseline justify-between border-t border-rule pt-3 text-base font-semibold"><span>Összesen</span><span className="tnum">{formatHuf(quote!.total)}</span></div>
            <p className="text-xs text-soft">Tájékoztató ár; a végleges összeget a visszaigazolásban küldjük.</p>
          </>
        ) : (
          <>
            <SumRow k={`${nights} éjszaka`} v="egyedi ajánlat" />
            <p className="text-xs text-soft">A pontos árat a visszaigazolással együtt küldjük.</p>
          </>
        )}
      </div>
    </div>
  )
}

function SumRow({ k, v }: { k: string; v: string }) {
  return <div className="flex items-baseline justify-between gap-4"><span className="text-fg/80">{k}</span><span className="tnum">{v}</span></div>
}

function Note({ children }: { children: React.ReactNode }) {
  return (
    <li className="flex gap-2.5">
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className="mt-0.5 shrink-0 text-pop"><path d="M4 12.5 9.5 18 20 6" /></svg>
      <span>{children}</span>
    </li>
  )
}

function CallLink({ phone }: { phone: string }) {
  return (
    <a href={telHref(phone)} className="inline-flex min-h-11 items-center gap-2 text-sm font-semibold text-fg/80 hover:text-fg">
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.1 4.2 2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1.9.4 1.8.7 2.7a2 2 0 0 1-.5 2.1L8 9.8a16 16 0 0 0 6 6l1.3-1.3a2 2 0 0 1 2.1-.4c.9.3 1.8.6 2.7.7a2 2 0 0 1 1.7 2z" /></svg>
      Inkább felhívom: {phone}
    </a>
  )
}

function SisterBox({ offer, sister }: { offer: { href: string; from: string; to: string }; sister: SisterInfo }) {
  return (
    <div className="mt-4 rounded-[var(--radius-lg)] border border-sel/30 bg-range p-4" role="status">
      <p className="font-semibold">Ezek a napok nálunk foglaltak, de a testvérházunk szabad: {fmtDay(parseISO(offer.from))} – {fmtDay(parseISO(offer.to))}</p>
      {sister.pitch && <p className="mt-1 text-sm text-fg/85">{sister.pitch}</p>}
      <a href={offer.href} className="btn btn-act btn-sm mt-3">Megnézem: {sister.name}</a>
    </div>
  )
}

function Field({ id, label, value, onChange, error, optional, ...rest }: { id: string; label: string; value: string; onChange: (v: string) => void; error?: string; optional?: boolean } & Omit<React.InputHTMLAttributes<HTMLInputElement>, 'onChange' | 'value' | 'id'>) {
  return (
    <div className="field">
      <label htmlFor={id}>{label}{optional && <span className="font-normal text-soft"> (nem kötelező)</span>}</label>
      <input id={id} className="input bk-input" value={value} onChange={(e) => onChange(e.target.value)} aria-invalid={!!error} aria-describedby={error ? `${id}-err` : undefined} {...rest} />
      {error && <p id={`${id}-err`} className="err">{error}</p>}
    </div>
  )
}

function Line({ dt, dd }: { dt: React.ReactNode; dd: React.ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-4 px-4 py-3">
      <dt className="text-soft">{dt}</dt>
      <dd className="font-semibold">{dd}</dd>
    </div>
  )
}

function Stepper({ value, min, max, onChange, label, unit }: { value: number; min: number; max: number; onChange: (n: number) => void; label: string; unit?: string }) {
  const btn = 'flex h-11 w-11 items-center justify-center rounded-full border border-fg/25 text-fg transition-colors hover:border-fg disabled:cursor-not-allowed disabled:opacity-30 disabled:hover:border-fg/25'
  return (
    <div className="flex shrink-0 items-center gap-3" role="group" aria-label={label}>
      <button type="button" aria-label={`${label}: kevesebb`} className={btn} onClick={() => onChange(Math.max(min, value - 1))} disabled={value <= min}>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><path d="M5 12h14" /></svg>
      </button>
      <span className="w-12 text-center text-lg font-semibold tnum" aria-live="polite">{value}{unit ? <span className="sr-only"> {unit}</span> : null}</span>
      <button type="button" aria-label={`${label}: több`} className={btn} onClick={() => onChange(Math.min(max, value + 1))} disabled={value >= max}>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><path d="M12 5v14M5 12h14" /></svg>
      </button>
    </div>
  )
}

function Choice({ checked, onChange, label, hint, icon }: { checked: boolean; onChange: (b: boolean) => void; label: string; hint: string; icon: React.ReactNode }) {
  return (
    <label className={`group relative flex min-h-[76px] cursor-pointer items-center gap-4 rounded-[var(--radius-lg)] border p-4 transition-[border-color,box-shadow,background-color] ${checked ? 'border-fg bg-surface-2/60 shadow-[inset_0_0_0_1px_var(--color-fg)]' : 'border-rule hover:border-fg/50'}`}>
      <input type="checkbox" className="peer sr-only" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className="shrink-0 text-fg/75">{icon}</svg>
      <span className="min-w-0 flex-1"><span className="block font-semibold">{label}</span><span className="block text-sm text-soft">{hint}</span></span>
      <span aria-hidden="true" className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full border transition-colors peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-focus ${checked ? 'border-sel bg-sel text-sel-fg' : 'border-fg/30'}`}>
        {checked && <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M4 12.5 9.5 18 20 6" /></svg>}
      </span>
    </label>
  )
}

function CodeBox({ code }: { code: string }) {
  const [copied, setCopied] = useState(false)
  async function copy() {
    try { await navigator.clipboard.writeText(code); setCopied(true); setTimeout(() => setCopied(false), 2200) } catch { /* clipboard blocked: the code stays selectable */ }
  }
  return (
    <div className="mx-auto mt-8 flex max-w-sm flex-col items-center gap-3 border border-dashed border-sel/45 bg-range px-5 py-4 min-[400px]:flex-row min-[400px]:justify-between min-[400px]:text-left">
      <div className="min-w-0">
        <p className="font-ui text-[0.66rem] font-bold uppercase tracking-[0.22em] text-soft">Foglalási kód</p>
        <p className="mt-1 select-all font-ui text-[1.6rem] font-bold leading-none tracking-[0.14em] text-fg tnum">{code}</p>
      </div>
      <button type="button" onClick={copy} className="inline-flex min-h-11 shrink-0 items-center justify-center gap-2 border border-fg/20 bg-surface px-3.5 text-sm font-semibold transition-colors hover:border-fg" aria-live="polite">
        {copied
          ? <><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M4 12.5 9.5 18 20 6" /></svg>Másolva</>
          : <><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><rect x="9" y="9" width="12" height="12" rx="1.5" /><path d="M5 15H4a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1h10a1 1 0 0 1 1 1v1" /></svg>Másolás</>}
      </button>
    </div>
  )
}

/** Booking-engine trust row. Every line is a fact of THIS system — nothing invented. */
function TrustRow({ confirmHours }: { confirmHours: number | null }) {
  const items: { t: string; d: string; icon: React.ReactNode }[] = [
    { t: 'Közvetlenül a háztól', d: 'Közvetítő és foglalási díj nélkül', icon: <path d="M3 10.5 12 3l9 7.5M5 9v11h14V9M10 20v-6h4v6" /> },
    { t: 'Most nem fizet', d: 'Online nem vonunk le pénzt', icon: <><rect x="2.5" y="5.5" width="19" height="13" rx="2" /><path d="M2.5 10h19M6.5 15h4" /></> },
    { t: confirmHours ? `${confirmHours} órán belül` : 'Gyors visszaigazolás', d: 'E-mailben visszaigazoljuk', icon: <><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></> },
    { t: 'Biztonságos kapcsolat', d: 'Titkosított adatküldés (HTTPS)', icon: <><rect x="4.5" y="10.5" width="15" height="10" rx="2" /><path d="M8 10.5V7a4 4 0 0 1 8 0v3.5" /></> },
  ]
  return (
    <ul className="mt-12 grid gap-x-5 gap-y-5 border-t border-rule pt-8 min-[400px]:grid-cols-2 min-[400px]:gap-y-6 lg:grid-cols-4" aria-label="Miért foglaljon nálunk">
      {items.map((it) => (
        <li key={it.t} className="flex items-start gap-3">
          <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className="mt-0.5 shrink-0 text-act">{it.icon}</svg>
          <span className="min-w-0"><span className="block text-[0.95rem] font-semibold leading-snug text-fg">{it.t}</span><span className="block text-[0.82rem] leading-snug text-soft">{it.d}</span></span>
        </li>
      ))}
    </ul>
  )
}
