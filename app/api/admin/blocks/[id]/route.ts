import { NextRequest, NextResponse } from 'next/server'
import { requireAdminApi } from '@/lib/admin/auth'
import { deleteBlock } from '@/lib/admin/actions'

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const a = await requireAdminApi(req)
  if (!a.ok) return a.res
  const { id } = await params
  const r = (await deleteBlock(a.session, id)) as { ok: boolean; reason?: string }
  return NextResponse.json(r, { status: r.ok ? 200 : r.reason === 'not_found' ? 404 : 400 })
}
