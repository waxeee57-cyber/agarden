import localFont from 'next/font/local'
import { Inter, Open_Sans } from 'next/font/google'

// The owner's reference (velenceviolavilla.hu) type system, 1:1:
//   Prata      headings (display serif). Upstream Prata has no ő/ű, so
//              assets/fonts/PrataHU-Regular.* is Prata (OFL 1.1, no Reserved
//              Font Name) + composed ő ű Ő Ű (o/u/O/U + its own U+030B mark),
//              renamed "Prata HU". Built and visually checked 2026-11-05.
//   Inter      tracked uppercase labels and buttons (700).
//   Open Sans  body text.
export const prata = localFont({ src: '../assets/fonts/PrataHU-Regular.woff2', weight: '400', variable: '--font-prata', display: 'swap', preload: true, fallback: ['Georgia', 'serif'] })
export const inter = Inter({ subsets: ['latin', 'latin-ext'], weight: ['500', '600', '700'], variable: '--font-inter', display: 'swap', preload: true })
export const openSans = Open_Sans({ subsets: ['latin', 'latin-ext'], weight: ['400', '600', '700'], variable: '--font-open', display: 'swap', preload: true })

export const fontVars = [prata.variable, inter.variable, openSans.variable].join(' ')
