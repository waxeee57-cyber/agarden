import { NextRequest, NextResponse } from 'next/server'
import { requireAdminApi } from '@/lib/admin/auth'
import { createManualBooking } from '@/lib/admin/actions'
import { statusFor } from '@/lib/booking/http'

// Manual (phone / external) booking, created as 'confirmed', holds the dates.
export async function POST(req: NextRequest) {
  const a = await requireAdminApi(req)
  if (!a.ok) return a.res
  let body: unknown
  try { body = await req.json() } catch { return NextResponse.json({ ok: false, reason: 'validation_error' }, { status: 400 }) }
  const r = await createManualBooking(a.session, body)
  return NextResponse.json(r, { status: statusFor(r) })
}
