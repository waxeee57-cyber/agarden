import type { Metadata } from 'next'
import Link from 'next/link'
import { requireAdminPage } from '@/lib/admin/guard'
import { siteOrigin, sisterOf } from '@/lib/site-map'
import { BRANDS } from '@/lib/brand'
import { Wordmark } from '@/components/property/ui'
import { AdminNav, LogoutButton } from '@/components/admin/AdminNav'

export const metadata: Metadata = { title: 'Admin', robots: { index: false, follow: false } }

export default async function PanelLayout({ children, params }: { children: React.ReactNode; params: Promise<{ site: string }> }) {
  const session = await requireAdminPage(params)
  const sister = sisterOf(session.site)
  return (
    <div className="min-h-svh bg-paper">
      <header className="border-b border-line bg-cream">
        <div className="mx-auto max-w-6xl px-4 pt-3 md:px-8">
          <div className="flex items-center justify-between gap-3">
            <Wordmark site={session.site} size={34} />
            <div className="flex items-center gap-2 text-sm">
              <a href={`${siteOrigin(sister)}/admin`} className="hidden min-h-12 items-center px-2 font-semibold text-deep underline underline-offset-2 sm:inline-flex">
                {BRANDS[sister].name} admin ↗
              </a>
              <LogoutButton />
            </div>
          </div>
          <div className="mt-2 pb-2"><AdminNav /></div>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-4 py-8 md:px-8">{children}</main>
      <footer className="mx-auto max-w-6xl px-4 pb-10 text-sm text-muted md:px-8">
        Belépve: {session.email} · <Link href="/" className="underline underline-offset-2">Weboldal megnyitása</Link> ·{' '}
        <a href={`${siteOrigin(sister)}/admin`} className="underline underline-offset-2 sm:hidden">{BRANDS[sister].name} admin ↗</a>
      </footer>
    </div>
  )
}
