import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { requireEnv } from './env'

// SSR anon client (cookie-bound). Runs as the logged-in user via their cookie
// session, so RLS sees `authenticated` for admins. Still the anon key — no
// service_role here. Mirrors RentalOS lib/supabase-server.ts.

requireEnv('NEXT_PUBLIC_SUPABASE_URL')
requireEnv('NEXT_PUBLIC_SUPABASE_ANON_KEY')

// For Route Handlers and Server Actions — can read and write cookies.
export async function createSupabaseServerClient() {
  const cookieStore = await cookies()
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => cookieStore.getAll(),
        setAll: (cookiesToSet) => {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options)
          )
        },
      },
    }
  )
}

// For Server Components — read-only (setAll is a no-op).
export async function createSupabaseServerComponentClient() {
  const cookieStore = await cookies()
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => cookieStore.getAll(),
        setAll: () => {},
      },
    }
  )
}

/**
 * Returns the authenticated Supabase User, or null if not logged in.
 * Uses getUser() (validated against Supabase) rather than getSession().
 */
export async function getAuthUser() {
  const supabase = await createSupabaseServerComponentClient()
  const { data: { user }, error } = await supabase.auth.getUser()
  if (error || !user) return null
  return user
}
