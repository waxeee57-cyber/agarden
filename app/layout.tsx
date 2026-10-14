import type { Viewport } from 'next'
import { Fraunces, Hanken_Grotesk } from 'next/font/google'
import './globals.css'

// latin-ext carries the Hungarian glyphs (ő ű Ő Ű …).
const fraunces = Fraunces({ subsets: ['latin', 'latin-ext'], variable: '--font-fraunces', display: 'swap' })
const hanken = Hanken_Grotesk({ subsets: ['latin', 'latin-ext'], variable: '--font-hanken', display: 'swap' })

// Per-site metadata (title, canonical, OG, icons, manifest) lives in
// app/[site]/layout.tsx — this root stays host-agnostic and static.
export const viewport: Viewport = { colorScheme: 'light', width: 'device-width', initialScale: 1 }

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="hu" className={`${fraunces.variable} ${hanken.variable}`} suppressHydrationWarning>
      <head>
        {/* Opt in to reveal animations only when JS runs (no-JS = fully visible). */}
        <script dangerouslySetInnerHTML={{ __html: "document.documentElement.classList.add('js')" }} />
      </head>
      <body>{children}</body>
    </html>
  )
}
