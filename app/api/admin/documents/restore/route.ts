import { NextRequest, NextResponse } from 'next/server'
import { requireAdminApi } from '@/lib/admin/auth'
import { restoreDocument } from '@/lib/admin/actions'

// POST { versionId } -> that version becomes live again (as a new version).
export async function POST(req: NextRequest) {
  const a = await requireAdminApi(req)
  if (!a.ok) return a.res
  const body = (await req.json().catch(() => null)) as { versionId?: unknown } | null
  const r = await restoreDocument(a.session, body?.versionId)
  return NextResponse.json(r, { status: r.ok ? 200 : r.reason === 'not_found' ? 404 : 400 })
}
