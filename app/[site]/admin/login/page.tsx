import type { Metadata } from 'next'
import { notFound, redirect } from 'next/navigation'
import { isSite } from '@/lib/site-map'
import { BRANDS } from '@/lib/brand'
import { getAdminSession } from '@/lib/admin/auth'
import { Wordmark } from '@/components/property/ui'
import { LoginForm } from '@/components/admin/LoginForm'

export const metadata: Metadata = { title: 'Belépés', robots: { index: false, follow: false } }

export default async function LoginPage({ params }: { params: Promise<{ site: string }> }) {
  const { site } = await params
  if (!isSite(site)) notFound()
  if (await getAdminSession(site)) redirect('/admin')
  return (
    <main className="flex min-h-svh items-center justify-center px-4 py-12">
      <div className="w-full max-w-sm">
        <Wordmark site={site} size={44} />
        <h1 className="mt-8 text-3xl">Tulajdonosi belépés</h1>
        <p className="mt-2 text-sm text-muted">{BRANDS[site].fullName} kezelése. A belépés csak ezen a domainen érvényes.</p>
        <LoginForm />
      </div>
    </main>
  )
}
