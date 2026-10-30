import { Young_Serif, Schibsted_Grotesk } from 'next/font/google'

// One type system for both houses (2026-10-30). Both families checked for
// ő ű Ő Ű (latin-ext) before use.
//   Young Serif        display, headings only (single weight: hierarchy by size).
//   Schibsted Grotesk  body + UI.
// Both are preloaded: the H1 is the LCP element on text pages and every page
// sets body copy above the fold.
export const youngSerif = Young_Serif({ subsets: ['latin', 'latin-ext'], weight: '400', variable: '--font-young', display: 'swap', preload: true })
export const schibsted = Schibsted_Grotesk({ subsets: ['latin', 'latin-ext'], variable: '--font-schibsted', display: 'swap', preload: true })

export const fontVars = [youngSerif.variable, schibsted.variable].join(' ')
