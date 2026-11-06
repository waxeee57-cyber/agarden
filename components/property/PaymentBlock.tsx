'use client'

import { useState } from 'react'
import type { PaymentInfo } from '@/lib/booking'
import { formatHuf } from '@/lib/format'

// Deposit instructions for the guest who owns the booking (booking response or
// code + e-mail lookup). Only facts the owner entered are shown; the rest is
// stated as "to be agreed by phone", never guessed.
export function PaymentBlock({ p, phone }: { p: PaymentInfo; phone: string }) {
  if (!p.depositPct) {
    return <p className="mt-6 text-sm text-soft">Fizetés a helyszínen. Kérdés esetén: <a className="font-semibold text-fg underline underline-offset-2" href={`tel:${phone.replace(/[^\d+]/g, '')}`}>{phone}</a></p>
  }
  return (
    <section className="lux-card mx-auto mt-6 max-w-sm rounded-[var(--radius-lg)] border border-rule bg-surface p-5 text-left" aria-label="Előleg">
      <p className="font-ui text-[0.66rem] font-bold uppercase tracking-[0.22em] text-soft">Előleg</p>
      <p className="mt-1 text-[1.35rem] font-semibold text-fg tnum">{p.depositAmount != null ? formatHuf(p.depositAmount) : `a szállásdíj ${p.depositPct}%-a`}</p>
      <dl className="mt-3 space-y-2 text-sm">
        {p.bankAccount
          ? <Copyable dt="Számlaszám" value={p.bankAccount} />
          : <div><dt className="text-soft">Számlaszám</dt><dd className="font-semibold text-fg">telefonon egyeztetjük: {phone}</dd></div>}
        {p.beneficiary && <div><dt className="text-soft">Kedvezményezett</dt><dd className="font-semibold text-fg">{p.beneficiary}</dd></div>}
        <Copyable dt="Közlemény" value={p.reference} />
      </dl>
      {p.cancelDays != null && <p className="mt-3 text-xs text-soft">Érkezés előtt {p.cancelDays} napnál korábbi lemondás esetén az előleg visszajár.</p>}
    </section>
  )
}

function Copyable({ dt, value }: { dt: string; value: string }) {
  const [ok, setOk] = useState(false)
  return (
    <div className="flex items-end justify-between gap-3">
      <div className="min-w-0"><dt className="text-soft">{dt}</dt><dd className="select-all font-semibold text-fg tnum [overflow-wrap:anywhere]">{value}</dd></div>
      <button type="button" className="min-h-9 shrink-0 border border-fg/20 px-2.5 text-xs font-semibold hover:border-fg" onClick={async () => { try { await navigator.clipboard.writeText(value); setOk(true); setTimeout(() => setOk(false), 1800) } catch { /* selectable */ } }}>
        {ok ? 'Másolva' : 'Másolás'}
      </button>
    </div>
  )
}
