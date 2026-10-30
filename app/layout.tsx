import type { Viewport } from 'next'
import { fontVars } from '@/lib/fonts'
import './globals.css'

// Per-site metadata (title, canonical, OG, icons, manifest) lives in
// app/[site]/layout.tsx — this root stays host-agnostic and static.
export const viewport: Viewport = { width: 'device-width', initialScale: 1 }

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="hu" className={fontVars} suppressHydrationWarning>
      <body>{children}</body>
    </html>
  )
}
