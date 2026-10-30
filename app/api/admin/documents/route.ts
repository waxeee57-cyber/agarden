import { NextRequest, NextResponse } from 'next/server'
import { requireAdminApi } from '@/lib/admin/auth'
import { updateDocument } from '@/lib/admin/actions'
import { listVersions } from '@/lib/admin/data'
import { DOC_KINDS, type DocKind } from '@/lib/terms'

// GET ?kind=hazirend -> the last 20 versions of THIS house's document.
export async function GET(req: NextRequest) {
  const a = await requireAdminApi(req)
  if (!a.ok) return a.res
  const kind = req.nextUrl.searchParams.get('kind') ?? ''
  if (!(DOC_KINDS as readonly string[]).includes(kind)) return NextResponse.json({ ok: false, reason: 'validation_error' }, { status: 400 })
  return NextResponse.json({ ok: true, versions: await listVersions(a.session.listingId, kind as DocKind) })
}

// PUT { kind, body, effectiveDate? } -> save + new version.
export async function PUT(req: NextRequest) {
  const a = await requireAdminApi(req)
  if (!a.ok) return a.res
  const r = await updateDocument(a.session, await req.json().catch(() => null))
  return NextResponse.json(r, { status: r.ok ? 200 : 400 })
}
