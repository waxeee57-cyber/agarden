import { createClient } from '@supabase/supabase-js'
import { requireEnv } from './env'

// Browser anon client. ONLY the public anon key — safe for the client bundle.
// Reads of guest PII (bookings / occupancy) are denied to anon by RLS; the
// public booking flow goes through the book_listing RPC, not direct inserts.

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
const supabaseAnonKey = requireEnv('NEXT_PUBLIC_SUPABASE_ANON_KEY') || FALLBACK_KEY

export const supabase = createClient(supabaseUrl, supabaseAnonKey)
