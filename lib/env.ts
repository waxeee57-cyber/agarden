/**
 * Validates that a required environment variable is present at runtime.
 *
 * Throws in production ONLY when the server is actually serving requests
 * (not during `next build` static generation), so local builds without a full
 * .env.local still succeed. On Vercel, all vars are present at both build and
 * runtime, so this is a no-op there.
 *
 * Mirrors RentalOS lib/env.ts — kept identical on purpose so the two codebases
 * share one startup-validation contract.
 */
export function requireEnv(key: string): string {
  const val = process.env[key]
  const isRuntime =
    process.env.NODE_ENV === 'production' &&
    process.env.NEXT_PHASE !== 'phase-production-build'

  if (!val && isRuntime) {
    throw new Error(`[startup] Missing required environment variable: ${key}`)
  }
  return val ?? ''
}
