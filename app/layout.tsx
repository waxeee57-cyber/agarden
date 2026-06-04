import type { Metadata } from 'next'
import { Fraunces, Hanken_Grotesk } from 'next/font/google'
import './globals.css'

// Distinct, non-generic pairing. latin-ext carries the Hungarian glyphs (ő ű á …).
const fraunces = Fraunces({
  subsets: ['latin', 'latin-ext'],
  variable: '--font-fraunces',
  display: 'swap',
})

const hanken = Hanken_Grotesk({
  subsets: ['latin', 'latin-ext'],
  variable: '--font-hanken',
  display: 'swap',
})

export const metadata: Metadata = {
  title: {
    default: 'Garden Vendégház Velence — egyben bérelhető nyaraló a Velencei-tó déli partján',
    template: '%s — Garden Vendégház Velence',
  },
  description:
    'Egész ház, max 10+2 fő, wellness sarokkal: 6 fős jakuzzi, 2 fős szauna, fedett terasz, kert grillel. A Velencei-tó déli partján — kérj ajánlatot vagy foglalj online.',
  openGraph: {
    siteName: 'Garden Vendégház Velence',
    locale: 'hu_HU',
    type: 'website',
  },
  robots: { index: true, follow: true },
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="hu" className={`${fraunces.variable} ${hanken.variable}`}>
      <body>{children}</body>
    </html>
  )
}
