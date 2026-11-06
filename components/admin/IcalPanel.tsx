'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import type { Feed } from '@/lib/ical'
import { adminFetch, reasonText } from './client'

// Airbnb / Booking.com / Szállás.hu calendar sync. Export: paste our link into
// their "import calendar". Import: paste their export link here; it is pulled
// every 3 hours (and on "Szinkronizálás most"). Busy days of theirs block ours.
export function IcalPanel({ exportUrl, feeds }: { exportUrl: string; feeds: Omit<Feed, 'listingId'>[] }) {
  const router = useRouter()
  const [label, setLabel] = useState('Airbnb')
  const [url, setUrl] = useState('')
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null)
  const [copied, setCopied] = useState(false)

  async function add(e: React.FormEvent) {
    e.preventDefault()
    setBusy(true); setMsg(null)
    const r = await adminFetch<{ ok: boolean; reason?: string; count?: number }>('/api/admin/ical', { method: 'POST', body: { label, url: url.trim() } })
    setBusy(false)
    if (r.ok) { setUrl(''); setMsg({ ok: true, text: `Hozzáadva, ${r.count ?? 0} foglalt időszak beolvasva.` }) }
    else setMsg({ ok: false, text: reasonText(r.reason) })
    router.refresh()
  }
  async function syncNow() {
    setBusy(true); setMsg(null)
    const r = await adminFetch<{ ok: boolean; synced?: number; total?: number }>('/api/admin/ical', { method: 'PUT' })
    setBusy(false)
    setMsg({ ok: r.ok, text: r.ok ? `Szinkronizálva (${r.synced}/${r.total}).` : `Nem minden naptár frissült (${r.synced ?? 0}/${r.total ?? 0}). Lásd lent a hibát.` })
    router.refresh()
  }
  async function remove(id: string) {
    setBusy(true)
    await adminFetch(`/api/admin/ical?id=${id}`, { method: 'DELETE' })
    setBusy(false); router.refresh()
  }

  return (
    <section className="card mt-8 p-5" aria-labelledby="ical-title">
      <h2 id="ical-title" className="text-xl">Naptár-szinkron (Airbnb, Booking.com, Szállás.hu)</h2>

      <h3 className="mt-5 font-semibold">1. A mi naptárunk más oldalakra</h3>
      <p className="mt-1 text-sm text-muted">Másold be ezt a linket a másik oldal „naptár importálása” mezőjébe. Csak a foglalt napokat mutatja, vendégadat nélkül.</p>
      <div className="mt-3 flex flex-col gap-2 sm:flex-row">
        <input readOnly className="input tnum min-w-0 flex-1 text-sm" value={exportUrl} onFocus={(e) => e.currentTarget.select()} aria-label="Exportálási link" />
        <button type="button" className="btn btn-line" onClick={async () => { try { await navigator.clipboard.writeText(exportUrl); setCopied(true); setTimeout(() => setCopied(false), 2000) } catch { /* select-all fallback */ } }}>{copied ? 'Másolva' : 'Link másolása'}</button>
      </div>

      <h3 className="mt-7 font-semibold">2. Más oldalak naptárai ide</h3>
      <p className="mt-1 text-sm text-muted">Az ottani „naptár exportálása” linket illeszd be. 3 óránként frissül; az ott foglalt napok itt is foglaltak lesznek.</p>
      {feeds.length > 0 && (
        <ul className="mt-4 divide-y divide-line border-y border-line">
          {feeds.map((f) => (
            <li key={f.id} className="flex flex-wrap items-center justify-between gap-3 py-3 text-sm">
              <div className="min-w-0">
                <p className="font-semibold">{f.label}</p>
                <p className="truncate text-muted" title={f.url}>{f.url}</p>
                <p className={f.lastError ? 'err' : 'text-muted'}>{f.lastError ? `Hiba: ${f.lastError}` : f.lastSync ? `Frissítve: ${f.lastSync} · ${f.lastCount ?? 0} időszak` : 'Még nem frissült'}</p>
              </div>
              <button type="button" className="btn btn-line btn-sm" disabled={busy} onClick={() => remove(f.id)}>Törlés</button>
            </li>
          ))}
        </ul>
      )}
      <form onSubmit={add} className="mt-4 grid gap-3 sm:grid-cols-[10rem_1fr_auto] sm:items-end">
        <div className="field">
          <label htmlFor="ical-label">Forrás</label>
          <select id="ical-label" className="input" value={label} onChange={(e) => setLabel(e.target.value)}>
            {['Airbnb', 'Booking.com', 'Szállás.hu', 'Egyéb'].map((x) => <option key={x}>{x}</option>)}
          </select>
        </div>
        <div className="field"><label htmlFor="ical-url">iCal link</label><input id="ical-url" type="url" required className="input" placeholder="https://…ics" value={url} onChange={(e) => setUrl(e.target.value)} /></div>
        <button type="submit" className="btn btn-dark" disabled={busy}>{busy ? 'Folyamatban…' : 'Hozzáadás'}</button>
      </form>
      {feeds.length > 0 && <button type="button" className="btn btn-line mt-4" disabled={busy} onClick={syncNow}>Szinkronizálás most</button>}
      {msg && <p className={`mt-3 ${msg.ok ? 'font-semibold text-success' : 'err'}`} role="status">{msg.text}</p>}
    </section>
  )
}
