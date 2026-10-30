'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import type { AdminListing } from '@/lib/admin/data'
import { adminFetch, reasonText } from './client'

// Homepage texts + contact. The house rules have their own versioned editor
// (Szövegek → Házirend); the legacy house_rules column is passed through unchanged.

export function ContentForm({ listing }: { listing: AdminListing }) {
  const router = useRouter()
  const [f, setF] = useState({
    tagline: listing.tagline ?? '',
    lead: listing.lead,
    introBody: listing.introBody,
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
      body: { tagline: f.tagline, lead: f.lead, introBody: f.introBody, houseRules: listing.houseRules, contactEmail: f.contactEmail.trim(), contactPhone: f.contactPhone },
    })
    setBusy(false)
    if (r.ok) { setMsg({ ok: true, text: 'Mentve. A weboldal néhány másodpercen belül frissül.' }); router.refresh() }
    else setMsg({ ok: false, text: reasonText(r.reason) })
  }

  return (
    <form onSubmit={save} className="card max-w-3xl space-y-4 p-5">
      <div className="field"><label htmlFor="c-tag">Szlogen (keresőtalálat leírása)</label><input id="c-tag" className="input" value={f.tagline} onChange={set('tagline')} maxLength={140} /></div>
      <div className="field"><label htmlFor="c-lead">Bemutatkozás a főoldalon (legfeljebb 3 mondat)</label><textarea id="c-lead" className="input" rows={3} value={f.lead} onChange={set('lead')} maxLength={400} /></div>
      <div className="field"><label htmlFor="c-intro">Hosszabb leírás (belső jegyzet, jelenleg nem jelenik meg)</label><textarea id="c-intro" className="input" rows={5} value={f.introBody} onChange={set('introBody')} maxLength={1500} /></div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="field"><label htmlFor="c-email">Kapcsolati e-mail (üresen: nem jelenik meg)</label><input id="c-email" type="email" className="input" value={f.contactEmail} onChange={set('contactEmail')} /></div>
        <div className="field"><label htmlFor="c-phone">Telefon</label><input id="c-phone" type="tel" className="input" value={f.contactPhone} onChange={set('contactPhone')} /></div>
      </div>
      {msg && <p className={msg.ok ? 'font-semibold text-success' : 'err'} role="status">{msg.text}</p>}
      <button type="submit" className="btn btn-dark" disabled={busy}>{busy ? 'Mentés…' : 'Tartalom mentése'}</button>
    </form>
  )
}
