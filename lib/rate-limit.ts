import 'server-only'
import { queryOne } from './db'

// DB-backed fixed-window rate limiter (rate_limit_hit() in 05_production.sql).
// Shared across all serverless instances, unlike the old in-memory Map.
// Fails OPEN on a DB error for public reads would be wrong for login, so the
// caller picks: `failClosed` for auth, default fail-open for guest forms (the
// DB being down already makes the form fail on its own write).

export async function rateLimit(key: string, limit: number, windowSeconds: number, failClosed = false): Promise<boolean> {
  try {
    const row = await queryOne<{ ok: boolean }>('select rate_limit_hit($1, $2, $3) as ok', [key, limit, windowSeconds])
    return row?.ok ?? !failClosed
  } catch (e) {
    console.error('[rate-limit]', e instanceof Error ? e.message : e)
    return !failClosed
  }
}

/** Real client IP from Vercel/proxy headers; 'anonymous' as last resort. */
export function getClientIp(req: { headers: { get(name: string): string | null } }): string {
  const forwarded = req.headers.get('x-forwarded-for')
  if (forwarded) return forwarded.split(',')[0].trim()
  return req.headers.get('x-real-ip') ?? 'anonymous'
}
