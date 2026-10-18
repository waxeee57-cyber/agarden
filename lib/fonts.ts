import localFont from 'next/font/local'
import { Schibsted_Grotesk, Shrikhand, Rethink_Sans } from 'next/font/google'

// Two houses, two voices. Every family checked for ő ű Ő Ű (latin-ext) before use.
//   Garden:   Big Shoulders (condensed signage, the sauna-house board) + Schibsted Grotesk.
//   Napsugár: Shrikhand (1970s holiday-postcard display, headlines only) + Rethink Sans.
// preload:false — each page renders only its own house's faces, so preloading
// the other house's fonts would be pure waste; the browser fetches what it uses.

// Big Shoulders is loaded from the vendored, glyph-checked TTF: the Google
// loader failed to resolve this family on Vercel (build of 2026-10-14).
export const bigShoulders = localFont({ src: '../assets/fonts/BigShoulders-ExtraBold.woff', weight: '800', variable: '--font-bigshoulders', display: 'swap', preload: false })
export const schibsted = Schibsted_Grotesk({ subsets: ['latin', 'latin-ext'], variable: '--font-schibsted', display: 'swap', preload: false })
export const shrikhand = Shrikhand({ subsets: ['latin', 'latin-ext'], weight: '400', variable: '--font-shrikhand', display: 'swap', preload: false })
export const rethink = Rethink_Sans({ subsets: ['latin', 'latin-ext'], variable: '--font-rethink', display: 'swap', preload: false })

export const fontVars = [bigShoulders.variable, schibsted.variable, shrikhand.variable, rethink.variable].join(' ')
