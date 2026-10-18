import localFont from 'next/font/local'
import { Schibsted_Grotesk, Shrikhand, Rethink_Sans } from 'next/font/google'

// Two houses, two voices. Every family checked for ő ű Ő Ű (latin-ext) before use.
//   Garden:   Big Shoulders (condensed signage, the sauna-house board) + Schibsted Grotesk.
//   Napsugár: Shrikhand (1970s holiday-postcard display, headlines only) + Rethink Sans.
// Display faces are preloaded: the H1 is the LCP element on text pages, and a
// late display font measured as ~1.6 s LCP render delay (2026-10-18). Body
// faces stay lazy (swap) — each page needs only its own house's body face.

// Big Shoulders is loaded from the vendored, glyph-checked TTF: the Google
// loader failed to resolve this family on Vercel (build of 2026-10-14).
export const bigShoulders = localFont({ src: '../assets/fonts/BigShoulders-ExtraBold.woff', weight: '800', variable: '--font-bigshoulders', display: 'swap', preload: true })
export const schibsted = Schibsted_Grotesk({ subsets: ['latin', 'latin-ext'], variable: '--font-schibsted', display: 'swap', preload: false })
export const shrikhand = Shrikhand({ subsets: ['latin', 'latin-ext'], weight: '400', variable: '--font-shrikhand', display: 'swap', preload: true })
export const rethink = Rethink_Sans({ subsets: ['latin', 'latin-ext'], variable: '--font-rethink', display: 'swap', preload: false })

export const fontVars = [bigShoulders.variable, schibsted.variable, shrikhand.variable, rethink.variable].join(' ')
