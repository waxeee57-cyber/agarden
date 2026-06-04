// Single place that maps anything (RPC reasons, thrown errors, supabase errors)
// to a STABLE error code the UI can render. Raw Postgres / supabase error text
// must never reach the client — unknown inputs collapse to 'unknown'.

export const BOOKING_ERROR_CODES = [
  'overlap',              // dates already taken (from the DB exclusion constraint)
  'min_nights',           // stay shorter than the listing minimum
  'invalid_dates',        // check_out <= check_in, or unparseable dates
  'capacity_unavailable', // guests exceed capacity, or listing is quote-only/placeholder
  'listing_not_found',    // no such listing
  'validation_error',     // zod input validation failed (RPC NOT called)
  'unknown',              // anything else — never leak raw DB text
] as const

export type BookingErrorCode = (typeof BOOKING_ERROR_CODES)[number]

const KNOWN = new Set<string>(BOOKING_ERROR_CODES)

// Reasons the slice-1 RPCs may return that aren't user-facing booking errors
// get folded into 'unknown' rather than leaked verbatim.
export function normalizeReason(reason: unknown): BookingErrorCode {
  if (typeof reason === 'string' && KNOWN.has(reason)) return reason as BookingErrorCode
  return 'unknown'
}

// For caught exceptions / supabase client errors: log server-side, return 'unknown'.
export function normalizeThrown(err: unknown, where: string): BookingErrorCode {
  console.error(`[booking:${where}]`, err instanceof Error ? err.message : err)
  return 'unknown'
}
