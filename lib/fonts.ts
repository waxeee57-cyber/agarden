import { Gilda_Display, Hanken_Grotesk } from 'next/font/google'

// One type system for both houses (2026-10-31, refined after the owner's
// reference velenceviolavilla.hu). Its display face, Prata, has no latin-ext
// (no ő/ű), so we use the closest didone that does: Gilda Display.
// Glyphs ő ű Ő Ű verified with fontTools on the vendored TTF.
//   Gilda Display   headings (single weight; hierarchy by size, never faux bold).
//   Hanken Grotesk  body + UI, variable weight (300–700 used).
export const gilda = Gilda_Display({ subsets: ['latin', 'latin-ext'], weight: '400', variable: '--font-gilda', display: 'swap', preload: true })
export const hanken = Hanken_Grotesk({ subsets: ['latin', 'latin-ext'], variable: '--font-hanken', display: 'swap', preload: true })

export const fontVars = [gilda.variable, hanken.variable].join(' ')
