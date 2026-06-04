import 'server-only'
import { createClient } from '@supabase/supabase-js'
import { requireEnv } from './env'

// service_role client. BYPASSES RLS. SERVER ONLY.
//
// The `import 'server-only'` above makes `next build` (and secret-guard.mjs)
// fail hard if this module is ever pulled into a client bundle. Use it only
// from server actions / route handlers for privileged work (e.g. attaching a
// confirmed booking to a tenant, admin reconciliation). Mirrors RentalOS.

const FALLBACK_URL = 'https://placeholder.supabase.co'
const FALLBACK_KEY = 'placeholder-key'

function validUrl(val: string): string {
  if (!val) return FALLBACK_URL
  try {
    const u = new URL(val)
    if (u.protocol === 'https:' || u.protocol === 'http:') return val
  } catch {}
  return FALLBACK_URL
}

const supabaseUrl = validUrl(requireEnv('NEXT_PUBLIC_SUPABASE_URL') || FALLBACK_URL)
const supabaseServiceKey = requireEnv('SUPABASE_SERVICE_ROLE_KEY') || FALLBACK_KEY

export const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
})
