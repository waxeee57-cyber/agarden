// Single place that maps anything (DB function reasons, thrown errors) to a
// STABLE error code the UI can render. Raw Postgres text never reaches the
// client — unknown inputs collapse to 'unknown'.

export const BOOKING_ERROR_CODES = [
  'overlap',              // dates already taken (DB exclusion constraint)
  'min_nights',           // stay shorter than the listing minimum
  'invalid_dates',        // check_out <= check_in, or unparseable dates
  'capacity_unavailable', // guests exceed capacity
  'listing_not_found',    // no such (active) listing
  'validation_error',     // zod input validation failed (DB NOT called)
  'rate_limited',         // too many requests from this client
  'unknown',              // anything else — never leak raw DB text
] as const

export type BookingErrorCode = (typeof BOOKING_ERROR_CODES)[number]

const KNOWN = new Set<string>(BOOKING_ERROR_CODES)

export function normalizeReason(reason: unknown): BookingErrorCode {
  if (typeof reason === 'string' && KNOWN.has(reason)) return reason as BookingErrorCode
  return 'unknown'
}

// Caught exceptions: log server-side (stderr → Vercel logs), return 'unknown'.
export function normalizeThrown(err: unknown, where: string): BookingErrorCode {
  console.error(`[booking:${where}]`, err instanceof Error ? err.message : err)
  return 'unknown'
}
