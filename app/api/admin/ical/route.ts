import { NextRequest, NextResponse } from 'next/server'
import { invalidateAvailability } from '@/lib/booking'
import { z } from 'zod'
import { requireAdminApi } from '@/lib/admin/auth'
import { query, queryOne } from '@/lib/db'
import { syncFeed } from '@/lib/ical'

// Admin: add / remove / sync-now external calendars of the session's house.
const addSchema = z.object({ label: z.string().trim().min(2).max(40), url: z.url().max(1000).refine((u) => u.startsWith('https://')) })

export async function POST(req: NextRequest) {
  const a = await requireAdminApi(req)
  if (!a.ok) return a.res
  const p = addSchema.safeParse(await req.json().catch(() => null))
  if (!p.success) return NextResponse.json({ ok: false, reason: 'feed_url' }, { status: 400 })
  const feed = await queryOne<{ id: string; listing_id: string; url: string }>(
    `insert into ical_feeds (listing_id, label, url) values ($1, $2, $3)
     on conflict (listing_id, url) do update set label = excluded.label returning id, listing_id, url`,
    [a.session.listingId, p.data.label, p.data.url]
  )
  const r = await syncFeed(feed!)
  // a link that never worked is not kept: the owner sees the error and retries
  if (!r.ok) await query('delete from ical_feeds where id = $1 and last_count is null', [feed!.id])
  invalidateAvailability()
  return NextResponse.json(r.ok ? { ok: true, count: r.count } : { ok: false, reason: 'feed_failed', error: r.error }, { status: r.ok ? 200 : 422 })
}

export async function PUT(req: NextRequest) {
  const a = await requireAdminApi(req)
  if (!a.ok) return a.res
  const feeds = await query<{ id: string; listing_id: string; url: string }>('select id, listing_id, url from ical_feeds where listing_id = $1', [a.session.listingId])
  const res = await Promise.all(feeds.map((f) => syncFeed(f)))
  invalidateAvailability()
  return NextResponse.json({ ok: res.every((r) => r.ok), synced: res.filter((r) => r.ok).length, total: feeds.length })
}

export async function DELETE(req: NextRequest) {
  const a = await requireAdminApi(req)
  if (!a.ok) return a.res
  const id = req.nextUrl.searchParams.get('id') ?? ''
  if (!z.guid().safeParse(id).success) return NextResponse.json({ ok: false, reason: 'validation_error' }, { status: 400 })
  // occupancy rows of the feed cascade (occupancy.feed_id on delete cascade)
  const rows = await query('delete from ical_feeds where id = $1 and listing_id = $2 returning id', [id, a.session.listingId])
  invalidateAvailability()
  return NextResponse.json(rows.length ? { ok: true } : { ok: false, reason: 'not_found' }, { status: rows.length ? 200 : 404 })
}
