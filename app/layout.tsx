import type { Viewport } from 'next'
import { fontVars } from '@/lib/fonts'
import './globals.css'

// Per-site metadata (title, canonical, OG, icons, manifest) lives in
// app/[site]/layout.tsx — this root stays host-agnostic and static.
// Theme colour varies per house (Garden is a dark site, Napsugár light),
// so it is set per page via the skin, not here.
export const viewport: Viewport = { width: 'device-width', initialScale: 1 }

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="hu" className={fontVars} suppressHydrationWarning>
      <head>
        {/* Opt in to reveal animations only when JS runs (no-JS = fully visible). */}
        <script dangerouslySetInnerHTML={{ __html: "document.documentElement.classList.add('js')" }} />
      </head>
      <body>{children}</body>
    </html>
  )
}
