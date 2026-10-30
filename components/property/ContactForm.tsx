'use client'

import { useState } from 'react'
import Link from 'next/link'
import { telHref } from '@/lib/brand'

// Kapcsolat form: errors next to each field, a clear success state, and the
// phone number always one tap away if something goes wrong.

const MSG: Record<string, string> = {
  name: 'Add meg a neved.',
  email: 'Érvényes e-mail címet adj meg, ide válaszolunk.',
  message: 'Írj legalább pár szót.',
}

export function ContactForm({ phone }: { phone: string }) {
  const [f, setF] = useState({ name: '', email: '', phone: '', message: '', website: '' })
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [state, setState] = useState<'idle' | 'sending' | 'sent' | 'error' | 'limited'>('idle')
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setF((x) => ({ ...x, [k]: e.target.value }))
    if (errors[k]) setErrors((x) => ({ ...x, [k]: '' }))
  }

  function validate() {
    const e: Record<string, string> = {}
    if (f.name.trim().length < 2) e.name = MSG.name
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(f.email.trim())) e.email = MSG.email
    if (f.message.trim().length < 5) e.message = MSG.message
    setErrors(e)
    return !Object.keys(e).length
  }

  async function submit(ev: React.FormEvent) {
    ev.preventDefault()
    if (!validate()) return
    setState('sending')
    try {
      const res = await fetch('/api/contact', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(f) })
      const data = (await res.json()) as { ok: boolean; reason?: string; fields?: string[] }
      if (data.ok) return setState('sent')
      if (data.reason === 'validation_error' && data.fields) {
        setErrors(Object.fromEntries(data.fields.map((k) => [k, MSG[k] ?? 'Ellenőrizd ezt a mezőt.'])))
        return setState('idle')
      }
      setState(data.reason === 'rate_limited' ? 'limited' : 'error')
    } catch {
      setState('error')
    }
  }

  if (state === 'sent') {
    return (
      <div className="panel p-6 md:p-8" role="status">
        <p className="kicker">Üzenet elküldve</p>
        <h3 className="mt-2 text-2xl">Köszönjük, megkaptuk.</h3>
        <p className="mt-3 text-soft">Hamarosan válaszolunk a megadott e-mail címre. Sürgős? Hívj: <a href={telHref(phone)} className="font-semibold text-fg underline underline-offset-4">{phone}</a></p>
      </div>
    )
  }

  const field = (k: 'name' | 'email' | 'phone', label: string, type: string, auto: string, optional = false) => (
    <div className="field">
      <label htmlFor={`c-${k}`}>{label}{optional && <span className="font-normal text-soft"> (nem kötelező)</span>}</label>
      <input id={`c-${k}`} type={type} className="input" value={f[k]} onChange={set(k)} autoComplete={auto} aria-invalid={!!errors[k]} aria-describedby={errors[k] ? `c-${k}-err` : undefined} />
      {errors[k] && <p id={`c-${k}-err`} className="err">{errors[k]}</p>}
    </div>
  )

  return (
    <form onSubmit={submit} noValidate className="panel grid gap-4 p-5 md:p-8">
      {field('name', 'Név', 'text', 'name')}
      <div className="grid gap-4 sm:grid-cols-2">
        {field('email', 'E-mail', 'email', 'email')}
        {field('phone', 'Telefon', 'tel', 'tel', true)}
      </div>
      <div className="field">
        <label htmlFor="c-message">Üzenet</label>
        <textarea id="c-message" rows={5} className="input" value={f.message} onChange={set('message')} aria-invalid={!!errors.message} aria-describedby={errors.message ? 'c-message-err' : undefined} />
        {errors.message && <p id="c-message-err" className="err">{errors.message}</p>}
      </div>
      {/* honeypot: hidden from people and assistive tech */}
      <div aria-hidden="true" className="absolute -left-[9999px] h-0 w-0 overflow-hidden">
        <label htmlFor="c-website">Weboldal</label>
        <input id="c-website" tabIndex={-1} autoComplete="off" value={f.website} onChange={set('website')} />
      </div>
      {state === 'error' && <p className="err" role="alert">Nem sikerült elküldeni. Próbáld újra, vagy hívj: <a href={telHref(phone)} className="underline">{phone}</a></p>}
      {state === 'limited' && <p className="err" role="alert">Túl sok üzenet rövid idő alatt. Várj pár percet, vagy hívj: <a href={telHref(phone)} className="underline">{phone}</a></p>}
      <button type="submit" className="btn btn-act" disabled={state === 'sending'}>{state === 'sending' ? 'Küldés…' : 'Üzenet küldése'}</button>
      <p className="text-xs text-soft">Az adataidat csak a válaszhoz használjuk, 90 nap után töröljük. <Link href="/adatvedelem" className="underline underline-offset-2">Adatvédelem</Link></p>
    </form>
  )
}
