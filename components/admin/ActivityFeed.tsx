'use client'

import { useEffect } from 'react'
import type { BookingEvent } from '@/lib/admin/data'
import { adminFetch } from './client'

const LABEL: Record<BookingEvent['event'], string> = {
  auto_confirmed: 'Új foglalás (visszaigazolva)',
  created: 'Új foglalási kérés – felülvizsgálatra vár',
  quote_request: 'Új ajánlatkérés',
  manual_booking: 'Kézi foglalás rögzítve',
  confirmed: 'Visszaigazolva',
  cancelled: 'Lemondva',
  deleted: 'Törölve',
}

// The system's own notification channel: every booking event, written by DB
// triggers, shown here. Nothing to configure, nothing external that can fail.
export function ActivityFeed({ events }: { events: BookingEvent[] }) {
  const unseen = events.some((e) => !e.seen)
  useEffect(() => { if (unseen) void adminFetch('/api/admin/events', { method: 'POST' }) }, [unseen])
  if (!events.length) return <p className="mt-2 text-sm text-muted">Még nincs esemény.</p>
  return (
    <ol className="mt-3 divide-y divide-line">
      {events.map((e) => (
        <li key={e.id} className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 py-2.5 text-sm">
          <span className={e.seen ? '' : 'font-semibold'}>
            {!e.seen && <span aria-hidden="true" className="mr-2 inline-block h-2 w-2 rounded-full bg-action" />}
            {LABEL[e.event]}{e.guest ? ` · ${e.guest}` : ''}{e.checkIn ? ` · ${e.checkIn} – ${e.checkOut}` : ''}{e.code ? ` · ${e.code}` : ''}
          </span>
          <time className="text-muted tnum">{e.at}</time>
        </li>
      ))}
    </ol>
  )
}
