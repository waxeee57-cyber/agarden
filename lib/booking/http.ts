import 'server-only'
import { NextRequest, NextResponse } from 'next/server'
import { rateLimit, getClientIp } from '@/lib/rate-limit'
import { requestHost } from '@/lib/site-map'
import type { BookingErrorCode } from './errors'

// Shared transport helpers for the thin route handlers: same-origin check,
// DB rate-limit, JSON parse, stable status mapping. Logic stays in lib.

export type GuardResult = { ok: true; body: unknown } | { ok: false; res: NextResponse }

/** CSRF defence for mutating requests: Origin (or Referer) must be this host. */
export function sameOrigin(req: NextRequest): boolean {
  const host = requestHost(req.headers).toLowerCase()
  const origin = req.headers.get('origin') ?? req.headers.get('referer')
  if (!origin || !host) return false
  try {
    return new URL(origin).host.toLowerCase() === host
  } catch {
    return false
  }
}

export async function guard(req: NextRequest, key: string, limit = 20, windowSeconds = 15 * 60): Promise<GuardResult> {
  if (!sameOrigin(req)) {
    return { ok: false, res: NextResponse.json({ ok: false, reason: 'forbidden' }, { status: 403 }) }
  }
  if (!(await rateLimit(`${key}:${getClientIp(req)}`, limit, windowSeconds))) {
    return { ok: false, res: NextResponse.json({ ok: false, reason: 'rate_limited' satisfies BookingErrorCode }, { status: 429 }) }
  }
  try {
    return { ok: true, body: await req.json() }
  } catch {
    return { ok: false, res: NextResponse.json({ ok: false, reason: 'validation_error' satisfies BookingErrorCode }, { status: 400 }) }
  }
}

// validation_error -> 400, any other failure -> 422, ok -> 200.
export function statusFor(result: { ok?: boolean; reason?: BookingErrorCode }): number {
  if (result.ok) return 200
  return result.reason === 'validation_error' ? 400 : 422
}
