'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { adminFetch, reasonText } from './client'

// Phone / external booking entered by the owner (pattern: costasol ManualBookingForm).
// Saved as 'confirmed' and holds the dates immediately.
export function ManualBookingForm({ maxGuests }: { maxGuests: number }) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [f, setF] = useState({ checkIn: '', checkOut: '', guests: 2, guestName: '', guestEmail: '', guestPhone: '', message: '' })
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null)
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setF({ ...f, [k]: k === 'guests' ? Number(e.target.value) : e.target.value })

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setBusy(true)
    setMsg(null)
    const r = await adminFetch('/api/admin/bookings', {
      method: 'POST',
      body: { ...f, guestPhone: f.guestPhone || undefined, message: f.message || undefined, pet: false, isEvent: false },
    })
    setBusy(false)
    if (r.ok) {
      setMsg({ ok: true, text: 'Rögzítve, a napok foglaltak.' })
      setF({ checkIn: '', checkOut: '', guests: 2, guestName: '', guestEmail: '', guestPhone: '', message: '' })
      router.refresh()
    } else setMsg({ ok: false, text: reasonText(r.reason) })
  }

  if (!open) return <button type="button" className="btn btn-primary" onClick={() => setOpen(true)}>+ Kézi foglalás</button>

  return (
    <form onSubmit={submit} className="card grid gap-3 p-5 sm:grid-cols-2">
      <h2 className="text-xl sm:col-span-2">Kézi foglalás</h2>
      <div className="field"><label htmlFor="m-in">Érkezés</label><input id="m-in" type="date" className="input" value={f.checkIn} onChange={set('checkIn')} required /></div>
      <div className="field"><label htmlFor="m-out">Távozás</label><input id="m-out" type="date" className="input" value={f.checkOut} onChange={set('checkOut')} required /></div>
      <div className="field"><label htmlFor="m-name">Vendég neve</label><input id="m-name" className="input" value={f.guestName} onChange={set('guestName')} required /></div>
      <div className="field"><label htmlFor="m-guests">Létszám</label><input id="m-guests" type="number" min={1} max={maxGuests} className="input" value={f.guests} onChange={set('guests')} /></div>
      <div className="field"><label htmlFor="m-email">E-mail</label><input id="m-email" type="email" className="input" value={f.guestEmail} onChange={set('guestEmail')} required /></div>
      <div className="field"><label htmlFor="m-phone">Telefon</label><input id="m-phone" type="tel" className="input" value={f.guestPhone} onChange={set('guestPhone')} /></div>
      <div className="field sm:col-span-2"><label htmlFor="m-note">Megjegyzés</label><textarea id="m-note" className="input" rows={2} value={f.message} onChange={set('message')} /></div>
      {msg && <p className={msg.ok ? 'text-sm font-semibold text-success sm:col-span-2' : 'err sm:col-span-2'} role="status">{msg.text}</p>}
      <div className="flex gap-2 sm:col-span-2">
        <button type="submit" className="btn btn-dark" disabled={busy}>{busy ? 'Mentés…' : 'Rögzítés'}</button>
        <button type="button" className="btn btn-ghost" onClick={() => setOpen(false)}>Bezár</button>
      </div>
    </form>
  )
}
