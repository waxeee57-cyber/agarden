import { NextRequest, NextResponse } from 'next/server'
import { getAvailability } from '@/lib/booking'
import { guard, statusFor } from '@/lib/booking/http'
import { rateLimit, getClientIp } from '@/lib/rate-limit'

export async function POST(req: NextRequest) {
  const g = await guard(req, 'availability', 60)
  if (!g.ok) return g.res
  const result = await getAvailability(g.body as Parameters<typeof getAvailability>[0])
  return NextResponse.json(result, { status: statusFor(result) })
}

// Convenience GET (same getAvailability call) — the /velence calendar reads it.
export async function GET(req: NextRequest) {
  const ip = getClientIp(req)
  if (!rateLimit(`${ip}:availability`, 60, 15 * 60 * 1000)) {
    return NextResponse.json({ ok: false, reason: 'unknown', error: 'Too many requests.' }, { status: 429 })
  }
  const { searchParams } = new URL(req.url)
  const result = await getAvailability({
    listingId: searchParams.get('listingId') ?? '',
    from: searchParams.get('from') ?? '',
    to: searchParams.get('to') ?? '',
  })
  return NextResponse.json(result, { status: statusFor(result) })
}
