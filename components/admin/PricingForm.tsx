'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import type { AdminListing } from '@/lib/admin/data'
import { adminFetch, reasonText } from './client'

const CALC = { per_stay: 'foglalásonként', per_night: 'éjszakánként', flat: 'egyszeri' } as const

export function PricingForm({ listing }: { listing: AdminListing }) {
  const router = useRouter()
  const [rate, setRate] = useState(listing.nightlyRate?.toString() ?? '')
  const [sur, setSur] = useState(listing.surcharges)
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null)

  async function save(e: React.FormEvent) {
    e.preventDefault()
    setBusy(true)
    setMsg(null)
    const nightlyRate = rate.trim() === '' ? null : Number(rate.replace(/\s/g, ''))
    const r = await adminFetch('/api/admin/pricing', { method: 'PUT', body: { nightlyRate, surcharges: sur } })
    setBusy(false)
    if (r.ok) { setMsg({ ok: true, text: nightlyRate == null ? 'Mentve. A ház ajánlatkérés módban marad.' : 'Mentve. A foglalónál már végösszeg jelenik meg.' }); router.refresh() }
    else setMsg({ ok: false, text: reasonText(r.reason) })
  }

  return (
    <form onSubmit={save} className="max-w-2xl space-y-8">
      <section className="card p-5">
        <h2 className="text-xl">Éjszakai díj</h2>
        <p className="mt-1 text-sm text-muted">Üresen hagyva a ház <strong>ajánlatkérés</strong> módban fut (nincs nyilvános ár). Ha megadod, a foglaló tájékoztató végösszeget számol.</p>
        <div className="field mt-4 max-w-xs">
          <label htmlFor="rate">Ft / éjszaka (az egész ház)</label>
          <input id="rate" inputMode="numeric" className="input tnum" value={rate} onChange={(e) => setRate(e.target.value)} placeholder="pl. 60000" />
        </div>
        <p className="mt-3 text-sm">Jelenlegi mód: <strong>{listing.pricingMode === 'fixed' ? 'fix ár' : 'ajánlatkérés'}</strong></p>
      </section>

      <section className="card p-5">
        <h2 className="text-xl">Felárak</h2>
        <p className="mt-1 text-sm text-muted">Csak a bekapcsolt felár számít bele. Az 1 éjszakás foglalás csak bekapcsolt „1 éjszakás felár” mellett engedélyezett.</p>
        <div className="mt-4 space-y-5">
          {sur.map((s, i) => (
            <fieldset key={s.code} className="grid gap-3 border-t border-line pt-4 sm:grid-cols-[auto_1fr_8rem_9rem] sm:items-end">
              <legend className="sr-only">{s.label}</legend>
              <label className="flex min-h-12 items-center gap-2 text-sm font-semibold">
                <input type="checkbox" className="h-5 w-5" checked={s.active} onChange={(e) => setSur(sur.map((x, j) => (j === i ? { ...x, active: e.target.checked } : x)))} />
                Aktív
              </label>
              <div className="field"><label htmlFor={`l-${s.code}`}>Megnevezés</label><input id={`l-${s.code}`} className="input" value={s.label} onChange={(e) => setSur(sur.map((x, j) => (j === i ? { ...x, label: e.target.value } : x)))} /></div>
              <div className="field"><label htmlFor={`a-${s.code}`}>Összeg (Ft)</label><input id={`a-${s.code}`} inputMode="numeric" className="input tnum" value={s.amount} onChange={(e) => setSur(sur.map((x, j) => (j === i ? { ...x, amount: Number(e.target.value.replace(/\D/g, '')) || 0 } : x)))} /></div>
              <div className="field">
                <label htmlFor={`c-${s.code}`}>Számítás</label>
                <select id={`c-${s.code}`} className="input" value={s.calc} onChange={(e) => setSur(sur.map((x, j) => (j === i ? { ...x, calc: e.target.value as typeof s.calc } : x)))}>
                  {Object.entries(CALC).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                </select>
              </div>
            </fieldset>
          ))}
        </div>
      </section>

      {msg && <p className={msg.ok ? 'font-semibold text-success' : 'err'} role="status">{msg.text}</p>}
      <button type="submit" className="btn btn-dark" disabled={busy}>{busy ? 'Mentés…' : 'Árak mentése'}</button>
    </form>
  )
}
