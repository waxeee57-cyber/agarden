'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import type { OccupancyRow } from '@/lib/admin/data'
import { adminFetch, reasonText } from './client'

// Owner calendar: month grid coloured by occupancy kind + add/remove blocks.
// Booking-held dates are released by cancelling the booking (Foglalások),
// so only manual/external blocks can be deleted here.

const MONTHS = ['január', 'február', 'március', 'április', 'május', 'június', 'július', 'augusztus', 'szeptember', 'október', 'november', 'december']
const pad = (n: number) => String(n).padStart(2, '0')
const iso = (y: number, m: number, d: number) => `${y}-${pad(m + 1)}-${pad(d)}`
const KIND = {
  booking: { label: 'foglalás', cls: 'bg-action text-cream' },
  manual: { label: 'kézi blokk', cls: 'bg-deep text-cream' },
  external: { label: 'külső (pl. szallas.hu)', cls: 'bg-accent text-ink' },
} as const

export function OccupancyBoard({ rows, months }: { rows: OccupancyRow[]; months: { y: number; m: number }[] }) {
  const router = useRouter()
  const [form, setForm] = useState({ from: '', to: '', kind: 'manual' as 'manual' | 'external', note: '' })
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null)

  const kindOn = (day: string) => rows.find((r) => r.from <= day && day < r.to)

  async function add(e: React.FormEvent) {
    e.preventDefault()
    setBusy(true)
    setMsg(null)
    const r = await adminFetch('/api/admin/blocks', { method: 'POST', body: { ...form, note: form.note || undefined } })
    setBusy(false)
    if (r.ok) { setMsg({ ok: true, text: 'Blokk rögzítve.' }); setForm({ ...form, from: '', to: '', note: '' }); router.refresh() }
    else setMsg({ ok: false, text: reasonText(r.reason) })
  }

  async function remove(id: string) {
    if (!window.confirm('Törlöd ezt a blokkot? A napok újra foglalhatók lesznek.')) return
    const r = await adminFetch(`/api/admin/blocks/${id}`, { method: 'DELETE' })
    if (r.ok) router.refresh()
    else setMsg({ ok: false, text: reasonText(r.reason) })
  }

  return (
    <div className="grid gap-8 lg:grid-cols-[1.4fr_1fr]">
      <div>
        <div className="flex flex-wrap gap-3 text-xs">
          {Object.values(KIND).map((k) => <span key={k.label} className="inline-flex items-center gap-1.5"><span className={`h-3 w-3 rounded-[3px] ${k.cls}`} aria-hidden="true" />{k.label}</span>)}
        </div>
        <div className="mt-4 grid gap-6 sm:grid-cols-2">
          {months.map(({ y, m }) => {
            const lead = (new Date(y, m, 1).getDay() + 6) % 7
            const days = new Date(y, m + 1, 0).getDate()
            return (
              <div key={`${y}-${m}`} className="rounded-[var(--radius-lg)] border border-line bg-cream p-3">
                <h3 className="mb-2 font-display text-lg">{y}. {MONTHS[m]}</h3>
                <div className="grid grid-cols-7 gap-1 text-center text-xs">
                  {['H', 'K', 'Sze', 'Cs', 'P', 'Szo', 'V'].map((x) => <div key={x} className="text-muted">{x}</div>)}
                  {Array.from({ length: lead }, (_, i) => <div key={`l${i}`} />)}
                  {Array.from({ length: days }, (_, i) => {
                    const day = iso(y, m, i + 1)
                    const o = kindOn(day)
                    return (
                      <div key={day} title={o ? `${KIND[o.kind].label}${o.guestName ? `: ${o.guestName}` : ''}${o.note ? ` (${o.note})` : ''}` : undefined} className={`flex h-9 items-center justify-center rounded-[6px] tnum ${o ? KIND[o.kind].cls : 'bg-paper/60'}`}>
                        {i + 1}
                      </div>
                    )
                  })}
                </div>
              </div>
            )
          })}
        </div>
      </div>

      <div className="space-y-6">
        <form onSubmit={add} className="card grid gap-3 p-5">
          <h2 className="text-xl">Napok blokkolása</h2>
          <p className="text-sm text-muted">Pl. más oldalon kapott foglalás vagy saját használat. A záró nap a távozás napja (aznap már érkezhet új vendég).</p>
          <div className="grid grid-cols-2 gap-3">
            <div className="field"><label htmlFor="b-from">Első éjszaka</label><input id="b-from" type="date" className="input" value={form.from} onChange={(e) => setForm({ ...form, from: e.target.value })} required /></div>
            <div className="field"><label htmlFor="b-to">Távozás napja</label><input id="b-to" type="date" className="input" value={form.to} onChange={(e) => setForm({ ...form, to: e.target.value })} required /></div>
          </div>
          <div className="field">
            <label htmlFor="b-kind">Típus</label>
            <select id="b-kind" className="input" value={form.kind} onChange={(e) => setForm({ ...form, kind: e.target.value as 'manual' | 'external' })}>
              <option value="manual">Kézi blokk</option>
              <option value="external">Külső foglalás</option>
            </select>
          </div>
          <div className="field"><label htmlFor="b-note">Megjegyzés</label><input id="b-note" className="input" value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} /></div>
          {msg && <p className={msg.ok ? 'text-sm font-semibold text-success' : 'err'} role="status">{msg.text}</p>}
          <button type="submit" className="btn btn-dark" disabled={busy}>{busy ? 'Mentés…' : 'Blokk hozzáadása'}</button>
        </form>

        <div>
          <h2 className="text-xl">Közelgő foglaltság</h2>
          <ul className="mt-3 divide-y divide-line rounded-[var(--radius-lg)] border border-line bg-cream">
            {rows.length === 0 && <li className="p-4 text-sm text-muted">Nincs foglalt nap a következő hónapokban.</li>}
            {rows.map((r) => (
              <li key={r.id} className="flex items-center gap-3 p-3 text-sm">
                <span className={`h-3 w-3 shrink-0 rounded-[3px] ${KIND[r.kind].cls}`} aria-hidden="true" />
                <span className="flex-1">
                  <span className="font-semibold tnum">{r.from} → {r.to}</span>
                  <span className="block text-muted">{KIND[r.kind].label}{r.guestName ? `: ${r.guestName}` : ''}{r.note ? ` · ${r.note}` : ''}</span>
                </span>
                {r.kind !== 'booking' && <button type="button" className="btn btn-ghost btn-sm" onClick={() => remove(r.id)}>Törlés</button>}
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  )
}
