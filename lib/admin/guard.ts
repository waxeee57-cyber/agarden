import 'server-only'
import { notFound, redirect } from 'next/navigation'
import { isSite } from '../site-map'
import { getAdminSession, type AdminSession } from './auth'

/** Page-level guard: every admin page calls this itself (not only the layout). */
export async function requireAdminPage(params: Promise<{ site: string }>): Promise<AdminSession> {
  const { site } = await params
  if (!isSite(site)) notFound()
  const session = await getAdminSession(site)
  if (!session) redirect('/admin/login')
  return session
}
