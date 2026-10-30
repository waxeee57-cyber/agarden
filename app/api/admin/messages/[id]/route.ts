import { NextRequest, NextResponse } from 'next/server'
import { requireAdminApi } from '@/lib/admin/auth'
import { setMessageHandled, deleteMessage } from '@/lib/admin/actions'

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const a = await requireAdminApi(req)
  if (!a.ok) return a.res
  const body = (await req.json().catch(() => null)) as { handled?: unknown } | null
  const r = await setMessageHandled(a.session, (await params).id, body?.handled === true)
  return NextResponse.json(r, { status: r.ok ? 200 : 404 })
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const a = await requireAdminApi(req)
  if (!a.ok) return a.res
  const r = await deleteMessage(a.session, (await params).id)
  return NextResponse.json(r, { status: r.ok ? 200 : 404 })
}
