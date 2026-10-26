'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

const ITEMS = [
  ['/admin', 'Foglalások'],
  ['/admin/naptar', 'Naptár'],
  ['/admin/arak', 'Árak'],
  ['/admin/tartalom', 'Tartalom'],
  ['/admin/fotok', 'Fotók'],
  ['/admin/adatok', 'Adatok'],
] as const

export function AdminNav() {
  // The browser sees /admin/…; internally it is /<site>/admin/… (proxy rewrite).
  const path = usePathname().replace(/^\/(velence|napsugar)(?=\/admin)/, '')
  return (
    <nav aria-label="Admin" className="-mx-4 overflow-x-auto px-4">
      <ul className="flex gap-1.5">
        {ITEMS.map(([href, label]) => {
          const active = href === '/admin' ? path === '/admin' : path.startsWith(href)
          return (
            <li key={href}>
              <Link
                href={href}
                aria-current={active ? 'page' : undefined}
                className={`inline-flex min-h-12 items-center whitespace-nowrap rounded-full px-4 text-sm font-semibold ${active ? 'bg-deep text-cream' : 'text-deep hover:bg-paper-2'}`}
              >
                {label}
              </Link>
            </li>
          )
        })}
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
