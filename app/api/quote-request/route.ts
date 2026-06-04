import { NextRequest, NextResponse } from 'next/server'
import { requestQuote } from '@/lib/booking'
import { guard, statusFor } from '@/lib/booking/http'

export async function POST(req: NextRequest) {
  const g = await guard(req, 'quote-request', 10)
  if (!g.ok) return g.res
  const result = await requestQuote(g.body as Parameters<typeof requestQuote>[0])
  return NextResponse.json(result, { status: statusFor(result) })
}
