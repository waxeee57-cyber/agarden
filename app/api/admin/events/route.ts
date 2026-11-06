import { NextRequest, NextResponse } from 'next/server'
import { requireAdminApi } from '@/lib/admin/auth'
import { query } from '@/lib/db'

// POST: mark this house's activity feed as seen (called when the owner has looked).
export async function POST(req: NextRequest) {
  const a = await requireAdminApi(req)
  if (!a.ok) return a.res
  await query('update booking_events set seen = true where listing_id = $1 and not seen', [a.session.listingId])
  return NextResponse.json({ ok: true })
}
