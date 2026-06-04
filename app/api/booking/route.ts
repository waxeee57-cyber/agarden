import { NextRequest, NextResponse } from 'next/server'
import { createBooking } from '@/lib/booking'
import { guard, statusFor } from '@/lib/booking/http'

export async function POST(req: NextRequest) {
  const g = await guard(req, 'booking', 10)
  if (!g.ok) return g.res
  const result = await createBooking(g.body as Parameters<typeof createBooking>[0])
  return NextResponse.json(result, { status: statusFor(result) })
}
