'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { formatHuf } from '@/lib/format'
import type { AdminBooking, BookingStatus } from '@/lib/admin/data'
import { adminFetch, reasonText } from './client'

// Booking + quote-request inbox (pattern: costasol BookingsList/BookingDetail).
// Rows expand inline; actions call /api/admin/bookings/[id].

const STATUS: Record<BookingStatus, { label: string; cls: string }> = {
  quote_request: { label: 'Ajánlatkérés', cls: 'bg-accent/20 text-ink' },
  pending: { label: 'Visszaigazolásra vár', cls: 'bg-clay/20 text-action-hover' },
  confirmed: { label: 'Visszaigazolva', cls: 'bg-success/15 text-success' },
  cancelled: { label: 'Lemondva', cls: 'bg-ink/10 text-muted' },
}

const MONTHS = ['jan.', 'febr.', 'márc.', 'ápr.', 'máj.', 'jún.', 'júl.', 'aug.', 'szept.', 'okt.', 'nov.', 'dec.']
const d = (iso: string | null) => {
  if (!iso) return '—'
  const [y, m, day] = iso.split('-').map(Number)
  return `${y}. ${MONTHS[m - 1]} ${day}.`
}

type Row = AdminBooking & { mail: { href: string; label: string } | null }

type Ical = { feeds: number; oldestSyncMinutes: number | null; lastSync: string | null }

export function BookingsBoard({ bookings, filters, current, ical }: { bookings: Row[]; filters: { key: string; label: string; count: number | null }[]; current: string; ical: Ical }) {
  const [open, setOpen] = useState<string | null>(null)
  return (
    <div>
      <div className="flex flex-wrap gap-2" role="navigation" aria-label="Szűrők">
        {filters.map((f) => (
          <Link
            key={f.key}
            href={f.key === 'uj' ? '/admin' : `/admin?szuro=${f.key}`}
            aria-current={current === f.key ? 'page' : undefined}
            className={`inline-flex min-h-12 items-center gap-2 rounded-full border px-4 text-sm font-semibold ${current === f.key ? 'border-deep bg-deep text-cream' : 'border-line bg-cream text-deep'}`}
          >
            {f.label}
            {f.count ? <span className="rounded-full bg-accent/30 px-2 text-xs text-ink">{f.count}</span> : null}
          </Link>
        ))}
      </div>

      {bookings.length === 0 ? (
        <p className="mt-10 rounded-[var(--radius-lg)] border border-dashed border-line p-8 text-center text-muted">Ebben a nézetben nincs tétel.</p>
      ) : (
        <ul className="mt-6 space-y-3">
          {bookings.map((b) => (
            <li key={b.id} className={`rounded-[var(--radius-lg)] border bg-cream ${open === b.id ? 'border-deep/40' : 'border-line'}`}>
              <button type="button" className="w-full p-4 text-left" aria-expanded={open === b.id} onClick={() => setOpen(open === b.id ? null : b.id)}>
                <div className="flex flex-wrap items-center gap-2">
                  <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${STATUS[b.status].cls}`}>{STATUS[b.status].label}</span>
                  {b.source === 'manual' && <span className="rounded-full bg-paper-2 px-2.5 py-1 text-xs font-semibold text-muted">kézi</span>}
                  {needsLetter(b) && <span className="rounded-full bg-clay/20 px-2.5 py-1 text-xs font-semibold text-action-hover">levél nincs jelölve</span>}
                  <span className="ml-auto text-xs text-muted tnum">{b.id.slice(0, 8).toUpperCase()}</span>
                </div>
                <p className="mt-2 font-display text-lg text-deep">{b.guestName}</p>
                <p className="text-sm text-ink/80">
                  {b.checkIn ? `${d(b.checkIn)} – ${d(b.checkOut)} · ${b.nights} éj` : 'dátum nélkül'}
                  {b.guests ? ` · ${b.guests} fő${b.children ? ` (${b.children} gyerek)` : ''}` : ''}
                  {b.total != null ? ` · ${formatHuf(b.total)}` : ''}
                </p>
              </button>
              {open === b.id && <BookingDetail b={b} ical={ical} />}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

const needsLetter = (b: Row) => b.source === 'web' && (b.status === 'confirmed' || b.status === 'cancelled') && !b.notifiedAt

const ago = (m: number) => (m < 2 ? 'az imént' : m < 60 ? `${m} perce` : m < 48 * 60 ? `${Math.round(m / 60)} órája` : `${Math.round(m / 1440)} napja`)

function BookingDetail({ b, ical }: { b: Row; ical: Ical }) {
  const router = useRouter()
  const [busy, setBusy] = useState<string | null>(null)
  const [msg, setMsg] = useState<string | null>(null)

  async function syncCalendars() {
    setBusy('sync')
    setMsg(null)
    const r = await adminFetch<{ ok: boolean; synced?: number; total?: number; reason?: string }>('/api/admin/ical', { method: 'PUT' })
    setBusy(null)
    if (!r.ok) setMsg(r.reason === 'rate_limited' ? 'Túl sok frissítés rövid időn belül, próbáld pár perc múlva.' : `Nem minden naptár frissült (${r.synced ?? 0}/${r.total ?? 0}). Részletek: Naptár.`)
    router.refresh()
  }

  async function markLetter(notified: boolean) {
    setBusy('letter')
    setMsg(null)
    const r = await adminFetch(`/api/admin/bookings/${b.id}`, { method: 'PATCH', body: { notified } })
    setBusy(null)
    if (r.ok) router.refresh()
    else setMsg(reasonText(r.reason))
  }

  async function act(kind: 'confirmed' | 'cancelled' | 'delete') {
    if (kind === 'delete' && !window.confirm('Végleg törlöd ezt a tételt? A lefoglalt napok felszabadulnak.')) return
    if (kind === 'cancelled' && !window.confirm(b.status === 'confirmed' ? 'Lemondod a visszaigazolt foglalást? A napok felszabadulnak.' : 'Elutasítod a kérelmet? A napok felszabadulnak.')) return
    setBusy(kind)
    setMsg(null)
    const r = kind === 'delete'
      ? await adminFetch(`/api/admin/bookings/${b.id}`, { method: 'DELETE' })
      : await adminFetch(`/api/admin/bookings/${b.id}`, { method: 'PATCH', body: { status: kind } })
    setBusy(null)
    if (r.ok) router.refresh()
    else setMsg(reasonText(r.reason))
  }

  return (
    <div className="border-t border-line p-4">
      <dl className="grid gap-x-6 gap-y-2 text-sm sm:grid-cols-2">
        <div><dt className="text-muted">E-mail</dt><dd><a className="break-all font-semibold underline underline-offset-2" href={`mailto:${b.guestEmail}`}>{b.guestEmail}</a></dd></div>
        <div><dt className="text-muted">Telefon</dt><dd>{b.guestPhone ? <a className="font-semibold underline underline-offset-2" href={`tel:${b.guestPhone}`}>{b.guestPhone}</a> : '—'}</dd></div>
        <div><dt className="text-muted">Extrák</dt><dd>{[b.pet && 'kisállat', b.isEvent && 'rendezvény / búcsú'].filter(Boolean).join(', ') || '—'}</dd></div>
        <div><dt className="text-muted">Beérkezett</dt><dd className="tnum">{b.createdAt.slice(0, 16).replace('T', ' ')}</dd></div>
        {b.notes && <div className="sm:col-span-2"><dt className="text-muted">Üzenet</dt><dd className="whitespace-pre-wrap">{b.notes}</dd></div>}
      </dl>
      {b.status === 'pending' && (
        <p className="mt-4 text-sm text-ink/80">Kérelem: a napok le vannak foglalva, de még nincs megállapodás. Ha a vendég vagy az időpont nem megfelelő, utasítsd el; különben igazold vissza, és küldd el a levelet.</p>
      )}
      {b.status === 'pending' && ical.feeds > 0 && (
        <div className={`mt-3 flex flex-wrap items-center gap-3 rounded-lg p-3 text-sm ${ical.oldestSyncMinutes == null || ical.oldestSyncMinutes > 60 ? 'bg-clay/15' : 'bg-black/[0.035]'}`}>
          <span>Külső naptárak (Airbnb, Booking…) frissítve: <strong>{ical.oldestSyncMinutes == null ? 'még soha' : ago(ical.oldestSyncMinutes)}</strong>{ical.lastSync ? ` (${ical.lastSync})` : ''}. Visszaigazolás előtt frissítsd, hogy az ottani friss foglalások is látsszanak.</span>
          <button type="button" className="btn btn-ghost btn-sm" disabled={!!busy} onClick={syncCalendars}>{busy === 'sync' ? 'Frissítés…' : 'Frissítés most'}</button>
        </div>
      )}
      <div className="mt-4 flex flex-wrap gap-2">
        {b.status !== 'confirmed' && b.status !== 'cancelled' && (
          <button type="button" className="btn btn-dark btn-sm" disabled={!!busy} onClick={() => act('confirmed')}>{busy === 'confirmed' ? '…' : 'Visszaigazolás'}</button>
        )}
        {b.status !== 'cancelled' && (
          <button type="button" className="btn btn-ghost btn-sm" disabled={!!busy} onClick={() => act('cancelled')}>{busy === 'cancelled' ? '…' : b.status === 'confirmed' ? 'Lemondás' : 'Elutasítás'}</button>
        )}
        <button type="button" className="btn btn-ghost btn-sm !text-danger" disabled={!!busy} onClick={() => act('delete')}>{busy === 'delete' ? '…' : 'Törlés'}</button>
      </div>
      {b.mail && (
        <a href={b.mail.href} className="btn btn-dark btn-sm mt-3 inline-flex">
          {b.mail.label} megírása <span aria-hidden="true">↗</span>
        </a>
      )}
      {b.source === 'web' && (b.status === 'confirmed' || b.status === 'cancelled') && (
        b.notifiedAt ? (
          <p className="mt-3 text-sm text-success">
            Levél elküldve: {b.notifiedAt}.{' '}
            <button type="button" className="underline underline-offset-2 text-muted" disabled={!!busy} onClick={() => markLetter(false)}>Mégsem ment el</button>
          </p>
        ) : (
          <button type="button" className="btn btn-ghost btn-sm mt-3 ml-0 sm:ml-2" disabled={!!busy} onClick={() => markLetter(true)}>{busy === 'letter' ? '…' : 'Elküldtem a levelet'}</button>
        )
      )}
      {msg && <p className="err mt-3" role="alert">{msg}</p>}
      <p className="mt-3 text-xs text-muted">
        A gomb a saját leveleződben nyit egy kész, a foglalás állapotához illő levelet (visszaigazoláskor a végösszeg és a helyszíni, készpénzes fizetés is benne van). Elküldés előtt átírhatod.
      </p>
    </div>
  )
}
