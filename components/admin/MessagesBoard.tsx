'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import type { AdminMessage } from '@/lib/admin/data'
import { adminFetch, reasonText } from './client'

// Kapcsolat-form messages. Stored even while e-mail is off; deleted after 90 days.
export function MessagesBoard({ messages }: { messages: AdminMessage[] }) {
  const router = useRouter()
  const [list, setList] = useState(messages)
  const [err, setErr] = useState<string | null>(null)

  async function toggle(m: AdminMessage) {
    const r = await adminFetch(`/api/admin/messages/${m.id}`, { method: 'PATCH', body: { handled: !m.handled } })
    if (!r.ok) return setErr(reasonText(r.reason))
    setList(list.map((x) => (x.id === m.id ? { ...x, handled: !m.handled } : x)))
    router.refresh()
  }
  async function remove(m: AdminMessage) {
    if (!window.confirm(`Törlöd ${m.name} üzenetét? Nem vonható vissza.`)) return
    const r = await adminFetch(`/api/admin/messages/${m.id}`, { method: 'DELETE' })
    if (!r.ok) return setErr(reasonText(r.reason))
    setList(list.filter((x) => x.id !== m.id))
    router.refresh()
  }

  if (!list.length) return <p className="rounded-[var(--radius-lg)] border border-dashed border-line p-6 text-center text-muted">Még nincs üzenet a Kapcsolat oldalról.</p>
  return (
    <div>
      {err && <p className="err mb-3" role="alert">{err}</p>}
      <ul className="space-y-3">
        {list.map((m) => (
          <li key={m.id} className={`card p-4 ${m.handled ? 'opacity-70' : ''}`}>
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <p className="font-semibold">{m.name} {!m.handled && <span className="ml-1 rounded-full bg-action px-2 py-0.5 text-xs text-cream">új</span>}</p>
              <p className="text-sm text-muted">{m.createdAt}</p>
            </div>
            <p className="mt-1 text-sm">
              <a className="underline underline-offset-2" href={`mailto:${m.email}`}>{m.email}</a>
              {m.phone && <> · <a className="underline underline-offset-2" href={`tel:${m.phone.replace(/[^\d+]/g, '')}`}>{m.phone}</a></>}
            </p>
            <p className="mt-2 whitespace-pre-line">{m.message}</p>
            <div className="mt-3 flex flex-wrap gap-2">
              <a className="btn btn-dark btn-sm" href={`mailto:${m.email}?subject=${encodeURIComponent('Válasz az üzenetedre')}`}>Válaszolok e-mailben</a>
              <button type="button" className="btn btn-ghost btn-sm" onClick={() => toggle(m)}>{m.handled ? 'Mégis megválaszolatlan' : 'Megválaszoltam'}</button>
              <button type="button" className="btn btn-ghost btn-sm !text-danger" onClick={() => remove(m)}>Törlés</button>
            </div>
          </li>
        ))}
      </ul>
    </div>
  )
}
