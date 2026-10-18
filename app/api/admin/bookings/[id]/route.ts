import { NextRequest, NextResponse, after } from 'next/server'
import { requireAdminApi } from '@/lib/admin/auth'
import { setBookingStatus, deleteBooking } from '@/lib/admin/actions'
import { sendStatusEmail } from '@/lib/email/send'

const code = (r: { ok: boolean; reason?: string }) => (r.ok ? 200 : r.reason === 'not_found' ? 404 : r.reason === 'validation_error' ? 400 : 422)

// PATCH { status: 'confirmed' | 'cancelled' } — occupancy synced in one transaction.
// On success the guest is told automatically, after the response (a mail
// failure never undoes or delays the status change).
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const a = await requireAdminApi(req)
  if (!a.ok) return a.res
  const { id } = await params
  const body = (await req.json().catch(() => ({}))) as { status?: unknown }
  const r = (await setBookingStatus(a.session, id, body.status)) as { ok: boolean; reason?: string }
  if (r.ok && (body.status === 'confirmed' || body.status === 'cancelled')) {
    const { site, listingId } = a.session
    const status = body.status
    after(() => sendStatusEmail(site, listingId, id, status))
  }
  return NextResponse.json(r, { status: code(r) })
}

// DELETE — removes the booking and its occupancy (cascade). No guest mail:
// delete is for test entries and clean-up, not a guest-facing decision.
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const a = await requireAdminApi(req)
  if (!a.ok) return a.res
  const { id } = await params
  const r = await deleteBooking(a.session, id)
  return NextResponse.json(r, { status: code(r as { ok: boolean; reason?: string }) })
}
