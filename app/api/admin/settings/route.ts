import { NextRequest, NextResponse } from 'next/server'
import { requireAdminApi } from '@/lib/admin/auth'
import { updateSettings } from '@/lib/admin/actions'

// PUT social links, menu toggles, booking terms, bank account.
export async function PUT(req: NextRequest) {
  const a = await requireAdminApi(req)
  if (!a.ok) return a.res
  const r = await updateSettings(a.session, await req.json().catch(() => null))
  return NextResponse.json(r, { status: r.ok ? 200 : 400 })
}
