'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import type { AdminSettings } from '@/lib/admin/data'
import { SOCIAL_NETWORKS, SOCIAL_LABEL, normalizeSocial, type SocialNetwork } from '@/lib/social'
import { adminFetch, reasonText } from './client'

// Social links (only filled + valid ones show on the site), menu toggles,
// booking terms, and the bank account — which goes ONLY into the confirmation
// e-mail, never onto a public page.

const EXAMPLE: Record<SocialNetwork, string> = {
  facebook: 'https://www.facebook.com/…',
  instagram: 'https://www.instagram.com/…',
  tiktok: 'https://www.tiktok.com/@…',
}
const num = (v: string) => (v.trim() === '' ? null : Number(v))

export function SettingsForm({ initial }: { initial: AdminSettings }) {
  const router = useRouter()
  const t = initial.terms
  const [social, setSocial] = useState<Record<SocialNetwork, string>>({ facebook: initial.social.facebook ?? '', instagram: initial.social.instagram ?? '', tiktok: initial.social.tiktok ?? '' })
  const [menu, setMenu] = useState(initial.settings)
  const [f, setF] = useState({
    depositPct: t.depositPct?.toString() ?? '', cancelDays: t.cancelDays?.toString() ?? '',
    confirmHours: t.confirmHours?.toString() ?? '', quoteValidDays: t.quoteValidDays?.toString() ?? '',
    extraCosts: t.extraCosts.join('\n'), bankAccount: initial.bankAccount,
  })
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null)

  function check(): boolean {
    const e: Record<string, string> = {}
    for (const n of SOCIAL_NETWORKS) if (social[n].trim() && !normalizeSocial(n, social[n])) e[`social.${n}`] = `Ez nem ${SOCIAL_LABEL[n]}-profil link. Példa: ${EXAMPLE[n]}`
    const range = (k: keyof typeof f, min: number, max: number, label: string) => {
      const v = f[k].trim()
      if (v && !(Number.isInteger(Number(v)) && Number(v) >= min && Number(v) <= max)) e[k] = `${label}: ${min} és ${max} közötti egész szám.`
    }
    range('depositPct', 1, 100, 'Előleg')
    range('cancelDays', 0, 365, 'Lemondási határidő')
    range('confirmHours', 1, 168, 'Visszaigazolás')
    range('quoteValidDays', 1, 60, 'Ajánlat érvényessége')
    if (f.bankAccount.trim() && !/^[0-9A-Z][0-9A-Z -]{7,40}$/i.test(f.bankAccount.trim())) e.bankAccount = 'Csak számjegy, betű (IBAN), szóköz és kötőjel.'
    setErrors(e)
    return !Object.keys(e).length
  }

  async function save(ev: React.FormEvent) {
    ev.preventDefault()
    setMsg(null)
    if (!check()) return setMsg({ ok: false, text: 'Javítsd a pirossal jelölt mezőket.' })
    setBusy(true)
    const r = await adminFetch<{ ok: boolean; reason?: string; fields?: string[] }>('/api/admin/settings', {
      method: 'PUT',
      body: {
        social, menuGyik: menu.menuGyik, menuKornyek: menu.menuKornyek,
        depositPct: num(f.depositPct), cancelDays: num(f.cancelDays), confirmHours: num(f.confirmHours), quoteValidDays: num(f.quoteValidDays),
        extraCosts: f.extraCosts.split('\n').map((x) => x.trim()).filter((x) => x.length >= 3),
        bankAccount: f.bankAccount.trim(),
      },
    })
    setBusy(false)
    if (r.ok) { setMsg({ ok: true, text: 'Mentve, a weboldal már az új adatokat mutatja.' }); router.refresh() }
    else {
      if (r.fields) setErrors(Object.fromEntries(r.fields.map((k) => [k, k.startsWith('social.') ? 'Érvénytelen link ennél a közösségi oldalnál.' : 'Ellenőrizd ezt a mezőt.'])))
      setMsg({ ok: false, text: r.reason === 'invalid_social' ? 'Valamelyik közösségi link nem az adott oldalé.' : reasonText(r.reason) })
    }
  }

  const input = (k: keyof typeof f, label: string, hint?: string, type = 'text') => (
    <div className="field">
      <label htmlFor={`s-${k}`}>{label}</label>
      <input id={`s-${k}`} type={type} inputMode={type === 'number' ? 'numeric' : undefined} className="input" value={f[k]} onChange={(e) => { setF({ ...f, [k]: e.target.value }); setErrors({ ...errors, [k]: '' }) }} aria-invalid={!!errors[k]} aria-describedby={`s-${k}-h`} />
      <p id={`s-${k}-h`} className={errors[k] ? 'err' : 'text-xs text-muted'}>{errors[k] || hint}</p>
    </div>
  )

  return (
    <form onSubmit={save} className="space-y-8" noValidate>
      <fieldset className="card space-y-4 p-5">
        <legend className="px-1 text-lg font-semibold text-deep">Közösségi oldalak</legend>
        <p className="text-sm text-muted">Csak a kitöltött linkek jelennek meg (menü, lábléc, Kapcsolat oldal).</p>
        {SOCIAL_NETWORKS.map((n) => (
          <div key={n} className="field">
            <label htmlFor={`s-${n}`}>{SOCIAL_LABEL[n]}</label>
            <input id={`s-${n}`} type="url" inputMode="url" className="input" placeholder={EXAMPLE[n]} value={social[n]} onChange={(e) => { setSocial({ ...social, [n]: e.target.value }); setErrors({ ...errors, [`social.${n}`]: '' }) }} aria-invalid={!!errors[`social.${n}`]} />
            {errors[`social.${n}`] && <p className="err">{errors[`social.${n}`]}</p>}
          </div>
        ))}
      </fieldset>

      <fieldset className="card space-y-3 p-5">
        <legend className="px-1 text-lg font-semibold text-deep">Menüpontok</legend>
        {([['menuGyik', 'GYIK (gyakori kérdések)'], ['menuKornyek', 'Környék & programok']] as const).map(([k, label]) => (
          <label key={k} className="flex min-h-12 cursor-pointer items-center gap-3">
            <input type="checkbox" className="h-6 w-6 accent-[var(--color-deep)]" checked={menu[k]} onChange={(e) => setMenu({ ...menu, [k]: e.target.checked })} />
            <span><strong>{label}</strong> megjelenik a menüben <span className="text-muted">(ha van szövege)</span></span>
          </label>
        ))}
      </fieldset>

      <fieldset className="card grid gap-4 p-5 sm:grid-cols-2">
        <legend className="px-1 text-lg font-semibold text-deep">Foglalási feltételek</legend>
        {input('depositPct', 'Előleg (%)', 'Üresen: nincs előleg, fizetés a helyszínen.', 'number')}
        {input('cancelDays', 'Az előleg visszajár, ha ennyi napnál korábban mondják le', 'Pl. 30', 'number')}
        {input('confirmHours', 'Visszaigazolás ennyi órán belül', 'Pl. 24', 'number')}
        {input('quoteValidDays', 'Az ajánlat ennyi napig érvényes', 'Pl. 4', 'number')}
        <div className="field sm:col-span-2">
          <label htmlFor="s-extra">Lehetséges plusz költségek (soronként egy)</label>
          <textarea id="s-extra" className="input" rows={3} value={f.extraCosts} onChange={(e) => setF({ ...f, extraCosts: e.target.value })} />
          <p className="text-xs text-muted">A foglalás összegzésénél és a visszaigazoló levélben jelenik meg.</p>
        </div>
        <div className="sm:col-span-2">
          {input('bankAccount', 'Bankszámlaszám az előleghez', 'Csak a visszaigazoló e-mailben jelenik meg, a weboldalon soha.')}
        </div>
      </fieldset>

      {msg && <p className={msg.ok ? 'font-semibold text-success' : 'err'} role="status">{msg.text}</p>}
      <button type="submit" className="btn btn-dark" disabled={busy}>{busy ? 'Mentés…' : 'Beállítások mentése'}</button>
    </form>
  )
}
