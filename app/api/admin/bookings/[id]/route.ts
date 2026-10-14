import { NextRequest, NextResponse } from 'next/server'
import { requireAdminApi } from '@/lib/admin/auth'
import { setBookingStatus, deleteBooking } from '@/lib/admin/actions'

const code = (r: { ok: boolean; reason?: string }) => (r.ok ? 200 : r.reason === 'not_found' ? 404 : r.reason === 'validation_error' ? 400 : 422)

// PATCH { status: 'confirmed' | 'cancelled' } — occupancy synced in one transaction.
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const a = await requireAdminApi(req)
  if (!a.ok) return a.res
  const { id } = await params
  const body = (await req.json().catch(() => ({}))) as { status?: unknown }
  const r = await setBookingStatus(a.session, id, body.status)
  return NextResponse.json(r, { status: code(r as { ok: boolean; reason?: string }) })
}

// DELETE — removes the booking and its occupancy (cascade).
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const a = await requireAdminApi(req)
  if (!a.ok) return a.res
  const { id } = await params
  const r = await deleteBooking(a.session, id)
  return NextResponse.json(r, { status: code(r as { ok: boolean; reason?: string }) })
}
