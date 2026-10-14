import { NextRequest, NextResponse } from 'next/server'
import { requireAdminApi } from '@/lib/admin/auth'

// Who am I, for THIS host? 401 without a valid session for the host's house.
export async function GET(req: NextRequest) {
  const a = await requireAdminApi(req)
  if (!a.ok) return a.res
  return NextResponse.json({ ok: true, email: a.session.email, site: a.session.site, listing: a.session.listingName })
}
