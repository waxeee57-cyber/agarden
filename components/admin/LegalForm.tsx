'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import type { AdminListing } from '@/lib/admin/data'
import { missingLegal } from '@/lib/legal'
import { adminFetch, reasonText } from './client'

// Owner fills in the operator / legal data the ÁSZF and the privacy notice need.
// Partial saves are fine: whatever is still empty stays "pótlásra vár" on the site.
// Placeholders are labelled examples only — nothing is pre-filled for the owner.

type F = {
  operatorName: string; operatorAddress: string; taxNumber: string
  checkinWindow: string; checkoutTime: string
  paymentTerms: string; cancellation: string; retention: string
  processorsConfirmed: boolean
}

export function LegalForm({ listing }: { listing: AdminListing }) {
  const router = useRouter()
  const l = listing.legal
  const [f, setF] = useState<F>({
    operatorName: l.operatorName ?? '', operatorAddress: l.operatorAddress ?? '', taxNumber: l.taxNumber ?? '',
    checkinWindow: listing.checkinWindow ?? '', checkoutTime: listing.checkoutTime ?? '',
    paymentTerms: l.paymentTerms ?? '', cancellation: l.cancellation ?? '', retention: l.retention ?? '',
    processorsConfirmed: l.processorsConfirmed === true,
  })
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null)
  const set = (k: keyof F) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setF({ ...f, [k]: e.target.value })

  const missing = missingLegal(
    { ...f, operatorName: f.operatorName.trim(), operatorAddress: f.operatorAddress.trim(), taxNumber: f.taxNumber.trim(), paymentTerms: f.paymentTerms.trim(), cancellation: f.cancellation.trim(), retention: f.retention.trim() },
    { checkinWindow: f.checkinWindow.trim() || null, checkoutTime: f.checkoutTime.trim() || null }
  )
  const total = 9
  const done = total - missing.length

  async function save(e: React.FormEvent) {
    e.preventDefault()
    setBusy(true)
    setMsg(null)
    const r = await adminFetch('/api/admin/legal', { method: 'PUT', body: f })
    setBusy(false)
    if (r.ok) {
      setMsg({ ok: true, text: missing.length ? 'Mentve. A hiányzó pontok az oldalon továbbra is „pótlásra vár” jelölést kapnak.' : 'Mentve. A jogi oldalak teljesek.' })
      router.refresh()
    } else setMsg({ ok: false, text: r.reason === 'validation_error' ? 'Ellenőrizd a mezőket (az adószám csak számjegyet és kötőjelet tartalmazhat).' : reasonText(r.reason) })
  }

  return (
    <form onSubmit={save} className="max-w-3xl space-y-6">
      <div className="card p-5" role="status" aria-live="polite">
        <p className="text-sm font-semibold">{done} / {total} kész</p>
        <div className="mt-2 h-2 overflow-hidden rounded-full bg-paper-2" aria-hidden>
          <div className="h-full rounded-full bg-deep transition-[width]" style={{ width: `${(done / total) * 100}%` }} />
        </div>
        {missing.length > 0 ? (
          <p className="mt-3 text-sm text-muted">Még hiányzik: {missing.map((m) => m.label).join(', ')}.</p>
        ) : (
          <p className="mt-3 text-sm font-semibold text-success">Minden adat megvan, az ÁSZF és az adatkezelési tájékoztató teljes.</p>
        )}
      </div>

      <fieldset className="card space-y-4 p-5">
        <legend className="px-1 text-lg font-semibold">1. Üzemeltető</legend>
        <p className="text-sm text-muted">Aki a szállást kiadja: magánszemély, egyéni vállalkozó vagy cég – úgy, ahogy az NTAK-ban és a számlákon szerepel.</p>
        <div className="field"><label htmlFor="l-name">Név</label><input id="l-name" className="input" value={f.operatorName} onChange={set('operatorName')} maxLength={160} autoComplete="organization" placeholder="Példa: Minta Anna egyéni vállalkozó" /></div>
        <div className="field"><label htmlFor="l-addr">Székhely / lakcím</label><input id="l-addr" className="input" value={f.operatorAddress} onChange={set('operatorAddress')} maxLength={200} autoComplete="street-address" placeholder="Példa: 2481 Velence, Minta utca 1." /></div>
        <div className="field"><label htmlFor="l-tax">Adószám (vagy magánszemélynél adóazonosító jel)</label><input id="l-tax" className="input" value={f.taxNumber} onChange={set('taxNumber')} maxLength={20} inputMode="numeric" placeholder="Példa: 12345678-1-07" /></div>
      </fieldset>

      <fieldset className="card space-y-4 p-5">
        <legend className="px-1 text-lg font-semibold">2. Érkezés és távozás</legend>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="field"><label htmlFor="l-in">Érkezés (időablak)</label><input id="l-in" className="input" value={f.checkinWindow} onChange={set('checkinWindow')} maxLength={40} placeholder="Példa: 14:00–18:00" /></div>
          <div className="field"><label htmlFor="l-out">Távozás (eddig)</label><input id="l-out" className="input" value={f.checkoutTime} onChange={set('checkoutTime')} maxLength={40} placeholder="Példa: 10:00" /></div>
        </div>
        <p className="text-sm text-muted">A visszaigazoló e-mailben és a Google-nek átadott adatokban is ez jelenik meg.</p>
      </fieldset>

      <fieldset className="card space-y-4 p-5">
        <legend className="px-1 text-lg font-semibold">3. Fizetés és lemondás</legend>
        <div className="field">
          <label htmlFor="l-pay">Fizetés, kaució, idegenforgalmi adó (soronként egy pont)</label>
          <textarea id="l-pay" className="input" rows={5} value={f.paymentTerms} onChange={set('paymentTerms')} maxLength={2000} placeholder={'Példa:\nA teljes összeg érkezéskor fizetendő, készpénzben vagy átutalással.\nKaució: … Ft, távozáskor visszajár.\nIdegenforgalmi adó: … Ft / fő / éj (18 év felett).'} />
        </div>
        <div className="field">
          <label htmlFor="l-cancel">Lemondási feltételek (soronként egy pont)</label>
          <textarea id="l-cancel" className="input" rows={5} value={f.cancellation} onChange={set('cancellation')} maxLength={2000} placeholder={'Példa:\nÉrkezés előtt 30 nappal díjmentes.\n30–8 nap között a szállásdíj 50%-a.\n7 napon belül a teljes szállásdíj.'} />
        </div>
      </fieldset>

      <fieldset className="card space-y-4 p-5">
        <legend className="px-1 text-lg font-semibold">4. Adatkezelés</legend>
        <div className="field">
          <label htmlFor="l-ret">Meddig őrzöd a vendégek foglalási adatait?</label>
          <textarea id="l-ret" className="input" rows={3} value={f.retention} onChange={set('retention')} maxLength={600} placeholder="Példa: a távozást követő 1 évig; a számlához kapcsolódó adatokat a számviteli törvény szerint 8 évig." />
        </div>
        <label className="flex items-start gap-3 text-sm">
          <input type="checkbox" className="mt-1 h-5 w-5 shrink-0" checked={f.processorsConfirmed} onChange={(e) => setF({ ...f, processorsConfirmed: e.target.checked })} />
          <span>
            Átnéztem és elfogadom, hogy az oldal a következő szolgáltatókat használja a foglalási adatokhoz:
            Vercel (tárhely, Frankfurt), Neon (adatbázis, Frankfurt), Resend (e-mail küldés). Az adatok az EU-ban vannak,
            a szolgáltatók amerikai anyavállalata miatt az uniós szerződéses garanciák alkalmazandók.
          </span>
        </label>
      </fieldset>

      {msg && <p className={msg.ok ? 'font-semibold text-success' : 'err'} role="status">{msg.text}</p>}
      <div className="sticky bottom-0 -mx-4 bg-paper/95 px-4 py-3 backdrop-blur md:static md:mx-0 md:bg-transparent md:p-0">
        <button type="submit" className="btn btn-dark w-full sm:w-auto" disabled={busy}>{busy ? 'Mentés…' : 'Adatok mentése'}</button>
      </div>
    </form>
  )
}
