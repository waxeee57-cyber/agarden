import { NextRequest, NextResponse } from 'next/server'
import { sameOrigin } from '@/lib/booking/http'
import { SESSION_COOKIE } from '@/lib/admin/auth'

export async function POST(req: NextRequest) {
  if (!sameOrigin(req)) return NextResponse.json({ ok: false, reason: 'forbidden' }, { status: 403 })
  const res = NextResponse.json({ ok: true })
  res.cookies.set({ name: SESSION_COOKIE, value: '', path: '/', maxAge: 0, httpOnly: true, sameSite: 'lax', secure: process.env.NODE_ENV === 'production' })
  return res
}
