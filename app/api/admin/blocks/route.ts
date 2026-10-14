import { NextRequest, NextResponse } from 'next/server'
import { requireAdminApi } from '@/lib/admin/auth'
import { createBlock } from '@/lib/admin/actions'

export async function POST(req: NextRequest) {
  const a = await requireAdminApi(req)
  if (!a.ok) return a.res
  const body = await req.json().catch(() => null)
  const r = (await createBlock(a.session, body)) as { ok: boolean; reason?: string }
  return NextResponse.json(r, { status: r.ok ? 200 : r.reason === 'validation_error' ? 400 : 422 })
}
