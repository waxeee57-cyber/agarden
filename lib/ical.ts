import 'server-only'
import { query, queryOne, tx } from './db'

// iCal sync (RFC 5545), dependency-free.
//  - export: own bookings + manual blocks as all-day busy events, dates only
//    (no guest data). External rows are NOT re-exported, so Airbnb/Booking
//    never see their own events echoed back.
//  - import: an external feed's busy days become occupancy rows (kind
//    'external', feed_id set). Each sync replaces that feed's rows; a range
//    that collides with a booking of ours is never overwritten (ON CONFLICT
//    DO NOTHING honours the exclusion constraint) — it is RECORDED in
//    ical_feeds.conflicts so the admin flags it before the owner confirms.

export type Range = { from: string; to: string } // [from, to) ISO dates

const ISO = /^\d{4}-\d{2}-\d{2}$/
const FETCH_TIMEOUT_MS = 8_000
const MAX_BYTES = 2_000_000

/** Unfold lines, then read DTSTART/DTEND of every VEVENT (all-day or date-time). */
export function parseIcs(text: string): Range[] {
  const lines = text.replace(/\r\n[ \t]/g, '').replace(/\n[ \t]/g, '').split(/\r?\n/)
  const out: Range[] = []
  let inEvent = false, start: string | null = null, end: string | null = null, cancelled = false
  const day = (v: string) => { const m = v.match(/(\d{4})(\d{2})(\d{2})/); return m ? `${m[1]}-${m[2]}-${m[3]}` : null }
  for (const raw of lines) {
    const line = raw.trim()
    if (line === 'BEGIN:VEVENT') { inEvent = true; start = end = null; cancelled = false; continue }
    if (line === 'END:VEVENT') {
      if (inEvent && start && !cancelled) {
        let to = end && end > start ? end : null
        if (!to) { const d = new Date(`${start}T00:00:00Z`); d.setUTCDate(d.getUTCDate() + 1); to = d.toISOString().slice(0, 10) }
        out.push({ from: start, to })
      }
      inEvent = false
      continue
    }
    if (!inEvent) continue
    const [key, ...rest] = line.split(':')
    const val = rest.join(':')
    const name = key.split(';')[0].toUpperCase()
    if (name === 'DTSTART') start = day(val)
    else if (name === 'DTEND') end = day(val)
    else if (name === 'STATUS' && val.toUpperCase() === 'CANCELLED') cancelled = true
  }
  return out.filter((r) => ISO.test(r.from) && ISO.test(r.to) && r.to > r.from)
}

const esc = (s: string) => s.replace(/[\\,;]/g, (m) => `\\${m}`).replace(/\r?\n/g, '\\n')

export function buildIcs(name: string, ranges: (Range & { uid: string })[]): string {
  const d = (s: string) => s.replace(/-/g, '')
  const stamp = new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '')
  const lines = [
    'BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//agarden//foglaltsag//HU', 'CALSCALE:GREGORIAN', 'METHOD:PUBLISH',
    `X-WR-CALNAME:${esc(name)}`,
    ...ranges.flatMap((r) => [
      'BEGIN:VEVENT', `UID:${r.uid}@agarden`, `DTSTAMP:${stamp}`,
      `DTSTART;VALUE=DATE:${d(r.from)}`, `DTEND;VALUE=DATE:${d(r.to)}`,
      'SUMMARY:Foglalt', 'TRANSP:OPAQUE', 'END:VEVENT',
    ]),
    'END:VCALENDAR',
  ]
  return lines.join('\r\n') + '\r\n'
}

export async function exportFor(token: string): Promise<{ name: string; ics: string } | null> {
  if (!/^[0-9a-f]{64}$/.test(token)) return null
  const l = await queryOne<{ id: string; site_name: string }>('select id, site_name from listings where ical_token = $1', [token])
  if (!l) return null
  const rows = await query<{ id: string; from: string; to: string }>(
    `select id::text, lower(during)::text as "from", upper(during)::text as "to" from occupancy
      where listing_id = $1 and kind <> 'external' and upper(during) >= current_date - 1
      order by lower(during)`,
    [l.id]
  )
  return { name: l.site_name, ics: buildIcs(l.site_name, rows.map((r) => ({ uid: r.id, from: r.from, to: r.to }))) }
}

export type Feed = { id: string; listingId: string; label: string; url: string; lastSync: string | null; lastError: string | null; lastCount: number | null }

/** Fetch with a hard timeout and size cap; one slow provider never stalls the run. */
async function fetchFeed(url: string): Promise<string> {
  const res = await fetch(url, { signal: AbortSignal.timeout(FETCH_TIMEOUT_MS), headers: { accept: 'text/calendar, text/plain;q=0.8' }, cache: 'no-store', redirect: 'follow' })
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  const len = Number(res.headers.get('content-length') ?? 0)
  if (len > MAX_BYTES) throw new Error('too large')
  const text = await res.text()
  if (text.length > MAX_BYTES) throw new Error('too large')
  if (!text.includes('BEGIN:VCALENDAR')) throw new Error('not an iCal feed')
  return text
}

/** An external busy range we could not import because one of our own rows holds those days. */
export type IcalConflict = { from: string; to: string; code: string | null; status: string | null; kind: string }

export async function syncFeed(feed: { id: string; listing_id: string; url: string }): Promise<{ ok: boolean; count?: number; conflicts?: IcalConflict[]; error?: string }> {
  try {
    const today = new Date().toISOString().slice(0, 10)
    const horizon = new Date(Date.now() + 2 * 365 * 86_400_000).toISOString().slice(0, 10)
    const ranges = parseIcs(await fetchFeed(feed.url)).filter((r) => r.to > today && r.from < horizon)
    let count = 0
    const conflicts: IcalConflict[] = []
    await tx(async (c) => {
      await c.query('delete from occupancy where feed_id = $1', [feed.id])
      for (const r of ranges) {
        const ins = await c.query(
          `insert into occupancy (listing_id, during, kind, feed_id, note) values ($1, daterange($2::date, $3::date, '[)'), 'external', $4, 'iCal')
           on conflict do nothing`,
          [feed.listing_id, r.from, r.to, feed.id]
        )
        count += ins.rowCount ?? 0
        if (!ins.rowCount) {
          // which of OUR rows blocked it? (other feeds' rows are not a clash worth flagging)
          const hit = await c.query<{ code: string | null; status: string | null; kind: string }>(
            `select upper(left(b.id::text, 8)) as code, b.status, o.kind
               from occupancy o left join bookings b on b.id = o.booking_id
              where o.listing_id = $1 and o.during && daterange($2::date, $3::date, '[)') and o.kind <> 'external'
              order by lower(o.during) limit 1`,
            [feed.listing_id, r.from, r.to]
          )
          const h = hit.rows[0]
          if (h) conflicts.push({ from: r.from, to: r.to, code: h.code, status: h.status, kind: h.kind })
        }
      }
      await c.query('update ical_feeds set last_sync = now(), last_error = null, last_count = $2, conflicts = $3::jsonb where id = $1', [feed.id, count, JSON.stringify(conflicts.slice(0, 50))])
    })
    return { ok: true, count, conflicts }
  } catch (e) {
    const msg = e instanceof Error ? e.message.slice(0, 200) : 'unknown'
    await query('update ical_feeds set last_sync = now(), last_error = $2 where id = $1', [feed.id, msg]).catch(() => {})
    return { ok: false, error: msg }
  }
}

/** Cron: every feed, in parallel, each bounded by its own timeout. */
export async function syncAll(): Promise<{ feeds: number; ok: number; changedListings: string[] }> {
  const feeds = await query<{ id: string; listing_id: string; url: string }>('select id, listing_id, url from ical_feeds')
  const res = await Promise.all(feeds.map((f) => syncFeed(f)))
  return { feeds: feeds.length, ok: res.filter((r) => r.ok).length, changedListings: [...new Set(feeds.map((f) => f.listing_id))] }
}

export async function listFeeds(listingId: string): Promise<Feed[]> {
  const rows = await query<{ id: string; label: string; url: string; last_sync: string | null; last_error: string | null; last_count: number | null }>(
    `select id, label, url, to_char(last_sync at time zone 'Europe/Budapest', 'YYYY-MM-DD HH24:MI') as last_sync, last_error, last_count
       from ical_feeds where listing_id = $1 order by created_at`,
    [listingId]
  )
  return rows.map((r) => ({ id: r.id, listingId, label: r.label, url: r.url, lastSync: r.last_sync, lastError: r.last_error, lastCount: r.last_count }))
}

export async function icalToken(listingId: string): Promise<string | null> {
  return (await queryOne<{ t: string }>('select ical_token as t from listings where id = $1', [listingId]))?.t ?? null
}
