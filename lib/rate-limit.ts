// Simple in-memory sliding window rate limiter.
//
// State is scoped to a single Vercel function instance. Different warm
// instances do not share state, so this isn't a perfect distributed limiter —
// but it reliably blocks sequential/scripted spam from a single IP hitting the
// same instance, which covers the realistic threat model for this app.
// No external dependencies required.

const store = new Map<string, number[]>()
let callCount = 0

function prune() {
  const now = Date.now()
  for (const [key, hits] of store.entries()) {
    if (hits.length === 0 || now - hits[hits.length - 1] > 3_600_000) {
      store.delete(key)
    }
  }
}

/**
 * Returns true if the request is allowed, false if it exceeds the rate limit.
 *
 * @param key      Typically the client IP address
 * @param limit    Maximum number of requests allowed within the window
 * @param windowMs Window duration in milliseconds
 */
export function rateLimit(key: string, limit: number, windowMs: number): boolean {
  // Prune stale entries every 500 calls to prevent unbounded Map growth
  if (++callCount % 500 === 0) prune()

  const now = Date.now()
  const cutoff = now - windowMs
  const hits = (store.get(key) ?? []).filter(t => t > cutoff)

  if (hits.length >= limit) return false

  hits.push(now)
  store.set(key, hits)
  return true
}

/**
 * Extracts the real client IP from Vercel/proxy headers.
 * Falls back to 'anonymous' so the rate limiter still functions.
 */
export function getClientIp(req: { headers: { get(name: string): string | null } }): string {
  const forwarded = req.headers.get('x-forwarded-for')
  if (forwarded) return forwarded.split(',')[0].trim()
  return req.headers.get('x-real-ip') ?? 'anonymous'
}
