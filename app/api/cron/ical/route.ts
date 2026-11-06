import { NextRequest, NextResponse } from 'next/server'
import { invalidateAvailability } from '@/lib/booking'
import { syncAll } from '@/lib/ical'

// Vercel Cron (vercel.json): pulls every external calendar. Vercel sends
// "Authorization: Bearer $CRON_SECRET"; anything else is refused.
export const maxDuration = 30

export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET
  if (!secret || req.headers.get('authorization') !== `Bearer ${secret}`) {
    return NextResponse.json({ ok: false }, { status: 401 })
  }
  const r = await syncAll()
  if (r.feeds) invalidateAvailability()
  return NextResponse.json({ done: true, feeds: r.feeds, synced: r.ok })
}
