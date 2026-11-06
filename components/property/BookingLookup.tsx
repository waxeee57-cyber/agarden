'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { fmtDay, parseISO } from './Calendar'
import { formatHuf } from '@/lib/format'
import { telHref } from '@/lib/brand'

type Found = { code: string; status: string; checkIn: string | null; checkOut: string | null; nights: number | null; guests: number | null; children: number; pet: boolean; isEvent: boolean; total: number | null; createdAt: string }

const STATUS: Record<string, { label: string; tone: string; text: string }> = {
  pending: { label: 'Visszaigazolásra vár', tone: 'bg-[#FFF4E0] text-[#8A5A00]', text: 'Megkaptuk a kérését, a dátumokat fenntartjuk. Hamarosan e-mailben visszaigazoljuk.' },
  confirmed: { label: 'Visszaigazolva', tone: 'bg-[#E6F4EA] text-[#1E6B34]', text: 'A foglalás érvényes. Szeretettel várjuk!' },
  cancelled: { label: 'Lemondva', tone: 'bg-[#FDECEA] text-[#A3271E]', text: 'Ez a foglalás le van mondva. Kérdés esetén hívjon minket.' },
  quote_request: { label: 'Ajánlatkérés', tone: 'bg-[#E8EEF1] text-[#3A525D]', text: 'Ajánlatkérését rögzítettük; a részletekkel e-mailben vagy telefonon jelentkezünk.' },
}

export function BookingLookup({ phone }: { phone: string }) {
  const params = useSearchParams()
  const [code, setCode] = useState((params.get('kod') ?? '').toUpperCase())
  const [email, setEmail] = useState('')
  const [state, setState] = useState<'idle' | 'loading' | 'notfound' | 'error' | 'limited'>('idle')
  const [found, setFound] = useState<Found | null>(null)
  const [err, setErr] = useState<Record<string, string>>({})

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    const v: Record<string, string> = {}
    if (!/^[0-9a-fA-F]{8}$/.test(code.trim())) v.code = 'A kód 8 karakter (számok és A–F betűk).'
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) v.email = 'Kérjük, a foglaláskor megadott e-mail-címet adja meg.'
    setErr(v)
    if (Object.keys(v).length) return
    setState('loading'); setFound(null)
    try {
      const res = await fetch('/api/booking-lookup', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ code: code.trim(), email: email.trim() }) })
      const data = await res.json()
      if (data.ok) { setFound(data.booking); setState('idle') }
      else setState(res.status === 404 ? 'notfound' : res.status === 429 ? 'limited' : 'error')
    } catch { setState('error') }
  }

  const s = found ? STATUS[found.status] ?? STATUS.pending : null
  return (
    <div className="grid items-start gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] lg:gap-12">
      <form onSubmit={submit} noValidate className="rounded-2xl border border-rule bg-surface p-5 md:p-7">
        <div className="grid gap-4">
          <div className="field">
            <label htmlFor="lk-code">Foglalási kód</label>
            <input id="lk-code" className="input bk-input font-ui uppercase tracking-[0.2em] tnum" maxLength={8} autoComplete="off" spellCheck={false} value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} aria-invalid={!!err.code} aria-describedby={err.code ? 'lk-code-err' : undefined} placeholder="PL. 3FA9C21B" />
            {err.code && <p id="lk-code-err" className="err">{err.code}</p>}
          </div>
          <div className="field">
            <label htmlFor="lk-email">E-mail</label>
            <input id="lk-email" type="email" inputMode="email" autoComplete="email" className="input bk-input" value={email} onChange={(e) => setEmail(e.target.value)} aria-invalid={!!err.email} aria-describedby={err.email ? 'lk-email-err' : undefined} />
            {err.email && <p id="lk-email-err" className="err">{err.email}</p>}
          </div>
        </div>
        <button type="submit" className="btn btn-act mt-6 w-full sm:w-auto" disabled={state === 'loading'}>{state === 'loading' ? 'Keresés…' : 'Megnézem'}</button>
        {state === 'notfound' && <p className="err mt-4" role="alert">Nem találunk ilyen foglalást ezzel a kóddal és e-mail-címmel. Kérjük, ellenőrizze az adatokat.</p>}
        {state === 'limited' && <p className="err mt-4" role="alert">Túl sok próbálkozás. Kérjük, várjon pár percet, vagy hívjon minket.</p>}
        {state === 'error' && <p className="err mt-4" role="alert">Most nem sikerült lekérdezni. Kérjük, próbálja újra, vagy hívjon minket: <a href={telHref(phone)} className="underline">{phone}</a></p>}
      </form>

      <div aria-live="polite">
        {found && s ? (
          <div className="bk-step rounded-2xl border border-rule bg-surface p-5 md:p-7">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <p className="font-ui text-[12px] font-bold uppercase tracking-[0.2em] text-soft">Kód: <span className="tnum text-fg">{found.code}</span></p>
              <span className={`rounded-full px-3 py-1 text-sm font-semibold ${s.tone}`}>{s.label}</span>
            </div>
            <p className="mt-4">{s.text}</p>
            <dl className="mt-5 divide-y divide-rule border-y border-rule text-[15px]">
              {found.checkIn && found.checkOut && <Row dt="Időpont" dd={`${fmtDay(parseISO(found.checkIn))} – ${fmtDay(parseISO(found.checkOut))}${found.nights ? ` · ${found.nights} éj` : ''}`} />}
              {found.guests != null && <Row dt="Vendégek" dd={`${found.guests} fő${found.children ? ` (ebből ${found.children} gyerek)` : ''}${found.pet ? ', kisállattal' : ''}${found.isEvent ? ', rendezvény' : ''}`} />}
              {found.total != null && <Row dt="Tájékoztató végösszeg" dd={formatHuf(found.total)} />}
            </dl>
            <div className="mt-6 grid gap-3 sm:flex sm:flex-wrap">
              <a href={telHref(phone)} className="btn btn-line">Kérdésem van</a>
              <Link href="/foglalas" className="btn btn-act">Új foglalás</Link>
            </div>
          </div>
        ) : (
          <div className="rounded-2xl bg-surface-2 p-5 text-[15px] md:p-7">
            <p className="font-display text-[1.35rem] text-fg">Mit lát itt?</p>
            <ul className="mt-3 grid gap-1.5">
              <li>– a foglalás állapotát (visszaigazolásra vár, visszaigazolva, lemondva),</li>
              <li>– az időpontot és a létszámot,</li>
              <li>– a tájékoztató végösszeget, ha van.</li>
            </ul>
            <p className="mt-3">Módosításhoz vagy lemondáshoz kérjük, hívjon minket: <a href={telHref(phone)} className="font-semibold text-fg underline underline-offset-2">{phone}</a></p>
          </div>
        )}
      </div>
    </div>
  )
}

function Row({ dt, dd }: { dt: string; dd: string }) {
  return (
    <div className="flex items-baseline justify-between gap-4 py-3">
      <dt className="text-soft">{dt}</dt>
      <dd className="text-right font-semibold text-fg">{dd}</dd>
    </div>
  )
}
