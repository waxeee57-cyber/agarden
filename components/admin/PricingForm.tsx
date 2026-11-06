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
  const [seasons, setSeasons] = useState(listing.seasons.map((x) => ({ ...x, rate: String(x.rate), minNights: x.minNights?.toString() ?? '' })))
  const [egFrom, setEgFrom] = useState(listing.extraGuestFrom?.toString() ?? '')
  const [egHuf, setEgHuf] = useState(listing.extraGuestHuf?.toString() ?? '')
  const num = (s: string) => (s.trim() === '' ? null : Number(s.replace(/\D/g, '')))
  const setSeason = (i: number, k: string, v: string) => setSeasons(seasons.map((x, j) => (j === i ? { ...x, [k]: v } : x)))
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null)

  async function save(e: React.FormEvent) {
    e.preventDefault()
    setBusy(true)
    setMsg(null)
    const nightlyRate = rate.trim() === '' ? null : Number(rate.replace(/\s/g, ''))
    const body = {
      nightlyRate, surcharges: sur,
      seasons: seasons.map((x) => ({ label: x.label, from: x.from, to: x.to, rate: num(x.rate) ?? 0, minNights: num(x.minNights) })),
      extraGuestFrom: num(egFrom), extraGuestHuf: num(egHuf),
    }
    const r = await adminFetch('/api/admin/pricing', { method: 'PUT', body })
    setBusy(false)
    if (r.ok) { setMsg({ ok: true, text: nightlyRate == null && !seasons.length ? 'Mentve. A ház ajánlatkérés módban marad.' : 'Mentve. A foglalónál már végösszeg jelenik meg (ahol minden éjszakának van ára).' }); router.refresh() }
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
        <h2 className="text-xl">Szezonális árak</h2>
        <p className="mt-1 text-sm text-muted">Az adott időszak éjszakái ezen az áron számolódnak, a többi az alapáron. Az „utolsó éjszaka” még a szezonhoz tartozik. A minimum éjszakaszám az időszakban érkezőkre vonatkozik. Az időszakok nem fedhetik egymást.</p>
        <div className="mt-4 space-y-4">
          {seasons.map((x, i) => (
            <fieldset key={i} className="grid gap-3 border-t border-line pt-4 sm:grid-cols-[1fr_9.5rem_9.5rem] sm:items-end">
              <legend className="sr-only">{x.label || `${i + 1}. szezon`}</legend>
              <div className="field"><label htmlFor={`sl-${i}`}>Megnevezés</label><input id={`sl-${i}`} className="input" value={x.label} onChange={(e) => setSeason(i, 'label', e.target.value)} placeholder="pl. Főszezon" /></div>
              <div className="field"><label htmlFor={`sf-${i}`}>Első éjszaka</label><input id={`sf-${i}`} type="date" className="input" value={x.from} onChange={(e) => setSeason(i, 'from', e.target.value)} /></div>
              <div className="field"><label htmlFor={`st-${i}`}>Utolsó éjszaka</label><input id={`st-${i}`} type="date" className="input" value={x.to} onChange={(e) => setSeason(i, 'to', e.target.value)} /></div>
              <div className="field"><label htmlFor={`sr-${i}`}>Ft / éjszaka</label><input id={`sr-${i}`} inputMode="numeric" className="input tnum" value={x.rate} onChange={(e) => setSeason(i, 'rate', e.target.value)} /></div>
              <div className="field"><label htmlFor={`sm-${i}`}>Min. éjszaka <span className="font-normal text-muted">(nem kötelező)</span></label><input id={`sm-${i}`} inputMode="numeric" className="input tnum" value={x.minNights} onChange={(e) => setSeason(i, 'minNights', e.target.value)} /></div>
              <button type="button" className="btn btn-line min-h-12" onClick={() => setSeasons(seasons.filter((_, j) => j !== i))}>Törlés</button>
            </fieldset>
          ))}
        </div>
        <button type="button" className="btn btn-line mt-4" onClick={() => setSeasons([...seasons, { label: '', from: '', to: '', rate: '', minNights: '' }])}>+ Szezon hozzáadása</button>
      </section>

      <section className="card p-5">
        <h2 className="text-xl">Létszámfelár</h2>
        <p className="mt-1 text-sm text-muted">Ennyi fő felett minden további vendég után éjszakánként felár jár. Üresen hagyva nincs létszámfelár.</p>
        <div className="mt-4 grid max-w-md gap-3 sm:grid-cols-2">
          <div className="field"><label htmlFor="eg-from">Ennyi fő felett</label><input id="eg-from" inputMode="numeric" className="input tnum" value={egFrom} onChange={(e) => setEgFrom(e.target.value)} placeholder="pl. 8" /></div>
          <div className="field"><label htmlFor="eg-huf">Ft / fő / éjszaka</label><input id="eg-huf" inputMode="numeric" className="input tnum" value={egHuf} onChange={(e) => setEgHuf(e.target.value)} placeholder="pl. 5000" /></div>
        </div>
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
