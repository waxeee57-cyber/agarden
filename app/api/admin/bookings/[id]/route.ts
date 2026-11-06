import { NextRequest, NextResponse } from 'next/server'
import { requireAdminApi } from '@/lib/admin/auth'
import { setBookingStatus, setGuestNotified, deleteBooking } from '@/lib/admin/actions'

const code = (r: { ok: boolean; reason?: string }) => (r.ok ? 200 : r.reason === 'not_found' ? 404 : r.reason === 'validation_error' ? 400 : 422)

// PATCH { status: 'confirmed' | 'cancelled' } — occupancy synced in one transaction.
// PATCH { notified: boolean } — the owner marks that the guest letter was sent.
// The guest is told by the owner from the admin ("…e-mail" button: a ready
// message in the owner's own mail app); the website sends nothing itself.
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const a = await requireAdminApi(req)
  if (!a.ok) return a.res
  const { id } = await params
  const body = (await req.json().catch(() => ({}))) as { status?: unknown; notified?: unknown }
  const r = ('notified' in body ? await setGuestNotified(a.session, id, body.notified) : await setBookingStatus(a.session, id, body.status)) as { ok: boolean; reason?: string }
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
