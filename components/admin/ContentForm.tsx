'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import type { AdminListing } from '@/lib/admin/data'
import { adminFetch, reasonText } from './client'

// House rules are edited one per line: "Cím: leírás".
const rulesToText = (r: { t: string; d: string }[]) => r.map((x) => (x.d ? `${x.t}: ${x.d}` : x.t)).join('\n')
const textToRules = (s: string) =>
  s.split('\n').map((l) => l.trim()).filter(Boolean).map((l) => {
    const i = l.indexOf(':')
    return i > 0 ? { t: l.slice(0, i).trim(), d: l.slice(i + 1).trim() } : { t: l, d: '' }
  })

export function ContentForm({ listing }: { listing: AdminListing }) {
  const router = useRouter()
  const [f, setF] = useState({
    tagline: listing.tagline ?? '',
    lead: listing.lead,
    introBody: listing.introBody,
    rules: rulesToText(listing.houseRules),
    contactEmail: listing.contactEmail ?? '',
    contactPhone: listing.contactPhone ?? '',
  })
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null)
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setF({ ...f, [k]: e.target.value })

  async function save(e: React.FormEvent) {
    e.preventDefault()
    setBusy(true)
    setMsg(null)
    const r = await adminFetch('/api/admin/content', {
      method: 'PUT',
      body: { tagline: f.tagline, lead: f.lead, introBody: f.introBody, houseRules: textToRules(f.rules), contactEmail: f.contactEmail.trim(), contactPhone: f.contactPhone },
    })
    setBusy(false)
    if (r.ok) { setMsg({ ok: true, text: 'Mentve. A weboldal néhány másodpercen belül frissül.' }); router.refresh() }
    else setMsg({ ok: false, text: reasonText(r.reason) })
  }

  return (
    <form onSubmit={save} className="card max-w-3xl space-y-4 p-5">
      <div className="field"><label htmlFor="c-tag">Szlogen (lábléc, testvérház-blokk)</label><input id="c-tag" className="input" value={f.tagline} onChange={set('tagline')} maxLength={140} /></div>
      <div className="field"><label htmlFor="c-lead">Bevezető a főképen</label><textarea id="c-lead" className="input" rows={3} value={f.lead} onChange={set('lead')} maxLength={400} /></div>
      <div className="field"><label htmlFor="c-intro">Leírás</label><textarea id="c-intro" className="input" rows={5} value={f.introBody} onChange={set('introBody')} maxLength={1500} /></div>
      <div className="field">
        <label htmlFor="c-rules">Házirend (soronként: „Cím: leírás”)</label>
        <textarea id="c-rules" className="input font-mono text-sm" rows={8} value={f.rules} onChange={set('rules')} />
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="field"><label htmlFor="c-email">Kapcsolati e-mail (üresen: nem jelenik meg)</label><input id="c-email" type="email" className="input" value={f.contactEmail} onChange={set('contactEmail')} /></div>
        <div className="field"><label htmlFor="c-phone">Telefon</label><input id="c-phone" type="tel" className="input" value={f.contactPhone} onChange={set('contactPhone')} /></div>
      </div>
      {msg && <p className={msg.ok ? 'font-semibold text-success' : 'err'} role="status">{msg.text}</p>}
      <button type="submit" className="btn btn-dark" disabled={busy}>{busy ? 'Mentés…' : 'Tartalom mentése'}</button>
    </form>
  )
}
