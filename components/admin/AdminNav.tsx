'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

// Six tabs. Desktop: a row under the header. Phone: a fixed bottom tab bar
// (thumb reach), each target ≥48 px.
const ITEMS = [
  ['/admin', 'Foglalások', 'M4 6h16M4 12h16M4 18h10'],
  ['/admin/naptar', 'Naptár', 'M5 5h14v15H5zM5 10h14M9 3v4m6-4v4'],
  ['/admin/arak', 'Árak', 'M4 12V5h7l9 9-7 7-9-9zm4-3h.01'],
  ['/admin/fotok', 'Képek', 'M4 6h16v13H4zM4 15l5-5 4 4 3-3 4 4M15 9h.01'],
  ['/admin/szovegek', 'Szövegek', 'M6 4h9l4 4v12H6zM9 12h7M9 16h7'],
  ['/admin/adatok', 'Adatok', 'M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8zm0-5v3m0 12v3M3 12h3m12 0h3'],
] as const

function useActive() {
  // The browser sees /admin/…; internally it is /<site>/admin/… (proxy rewrite).
  const path = usePathname().replace(/^\/(velence|napsugar)(?=\/admin)/, '')
  return (href: string) => (href === '/admin' ? path === '/admin' : path.startsWith(href))
}

export function AdminNav() {
  const active = useActive()
  return (
    <nav aria-label="Admin" className="hidden md:block">
      <ul className="flex gap-1.5">
        {ITEMS.map(([href, label]) => (
          <li key={href}>
            <Link href={href} aria-current={active(href) ? 'page' : undefined} className={`inline-flex min-h-12 items-center whitespace-nowrap rounded-full px-4 text-sm font-semibold ${active(href) ? 'bg-deep text-cream' : 'text-deep hover:bg-paper-2'}`}>
              {label}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  )
}

export function AdminTabBar() {
  const active = useActive()
  return (
    <nav aria-label="Admin" className="fixed inset-x-0 bottom-0 z-40 border-t border-line bg-cream md:hidden" style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}>
      <ul className="grid grid-cols-6">
        {ITEMS.map(([href, label, d]) => (
          <li key={href}>
            <Link href={href} aria-current={active(href) ? 'page' : undefined} className={`flex min-h-16 flex-col items-center justify-center gap-1 text-[0.68rem] font-semibold ${active(href) ? 'text-deep' : 'text-muted'}`}>
              <span className={`flex h-7 w-12 items-center justify-center rounded-full ${active(href) ? 'bg-paper-2' : ''}`}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={d} /></svg>
              </span>
              {label}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  )
}

export function LogoutButton() {
  return (
    <button
      type="button"
      className="min-h-12 px-2 text-sm font-semibold text-muted underline underline-offset-2"
      onClick={async () => {
        await fetch('/api/admin/logout', { method: 'POST' })
        window.location.href = '/admin/login'
      }}
    >
      Kilépés
    </button>
  )
}
