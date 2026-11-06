import { NextRequest, NextResponse } from 'next/server'
import { invalidateAvailability } from '@/lib/booking'
import { syncAll } from '@/lib/ical'
import { rateLimit } from '@/lib/rate-limit'

// Vercel Cron (vercel.json, every 3 h) pulls every external calendar.
//  - CRON_SECRET set   -> only "Authorization: Bearer $CRON_SECRET" is accepted
//    (Vercel Cron sends it automatically).
//  - CRON_SECRET unset -> still works, but at most ONE run per 10 minutes
//    globally. The job is idempotent and exposes nothing (it only re-reads
//    the owner's configured feeds), so the worst a stranger can do is trigger
//    the same sync early; the throttle keeps that from costing anything.
export const maxDuration = 30

export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET
  if (secret) {
    if (req.headers.get('authorization') !== `Bearer ${secret}`) return NextResponse.json({ ok: false }, { status: 401 })
  } else if (!(await rateLimit('cron-ical:global', 1, 600).catch(() => false))) {
    return NextResponse.json({ ok: true, skipped: 'throttled' }, { status: 200 })
  }
  const r = await syncAll()
  if (r.feeds) invalidateAvailability()
  return NextResponse.json({ done: true, feeds: r.feeds, synced: r.ok })
}
