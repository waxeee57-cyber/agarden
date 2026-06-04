import { NextRequest, NextResponse } from 'next/server'
import { rateLimit, getClientIp } from '@/lib/rate-limit'
import type { BookingErrorCode } from './errors'

// Shared helpers for the thin booking route handlers. The handlers themselves
// add NOTHING but transport: rate-limit, parse JSON, call the tested lib
// function, map the stable result to an HTTP status. All logic stays in lib.

export type GuardResult = { ok: true; body: unknown } | { ok: false; res: NextResponse }

export async function guard(req: NextRequest, key: string, limit = 20): Promise<GuardResult> {
  const ip = getClientIp(req)
  if (!rateLimit(`${ip}:${key}`, limit, 15 * 60 * 1000)) {
    return { ok: false, res: NextResponse.json({ error: 'Too many requests.' }, { status: 429 }) }
  }
  let body: unknown
  try {
    body = await req.json()
  } catch {
    return { ok: false, res: NextResponse.json({ reason: 'validation_error' satisfies BookingErrorCode }, { status: 400 }) }
  }
  return { ok: true, body }
}

// validation_error -> 400, any other failure reason -> 422 (Unprocessable), ok -> 200.
export function statusFor(result: { ok?: boolean; reason?: BookingErrorCode }): number {
  if (result.ok) return 200
  return result.reason === 'validation_error' ? 400 : 422
}
