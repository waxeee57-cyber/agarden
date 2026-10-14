import { NextRequest, NextResponse } from 'next/server'
import { requireAdminApi } from '@/lib/admin/auth'
import { updatePricing } from '@/lib/admin/actions'

export async function PUT(req: NextRequest) {
  const a = await requireAdminApi(req)
  if (!a.ok) return a.res
  const body = await req.json().catch(() => null)
  const r = (await updatePricing(a.session, body)) as { ok: boolean; reason?: string }
  return NextResponse.json(r, { status: r.ok ? 200 : 400 })
}
