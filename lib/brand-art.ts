import 'server-only'
import { readFile } from 'node:fs/promises'
import { join } from 'node:path'
import type { Site } from './site-map'

// Fonts for the host-aware image routes (app/brand/*): vendored TTFs in
// assets/fonts, each verified to contain ő ű Ő Ű. The default ImageResponse
// font is not trusted with Hungarian accents.
const FILES: Record<Site, { display: [string, string, 400 | 800]; sans: [string, string] }> = {
  velence: { display: ['Big Shoulders', 'BigShoulders-ExtraBold.ttf', 800], sans: ['Schibsted Grotesk', 'SchibstedGrotesk-Regular.ttf'] },
  napsugar: { display: ['Shrikhand', 'Shrikhand-Regular.ttf', 400], sans: ['Rethink Sans', 'RethinkSans-Regular.ttf'] },
}

export async function ogFonts(site: Site) {
  const dir = join(process.cwd(), 'assets', 'fonts')
  const f = FILES[site]
  const [display, sans] = await Promise.all([readFile(join(dir, f.display[1])), readFile(join(dir, f.sans[1]))])
  return {
    displayName: f.display[0],
    sansName: f.sans[0],
    fonts: [
      { name: f.display[0], data: display, weight: f.display[2], style: 'normal' as const },
      { name: f.sans[0], data: sans, weight: 400 as const, style: 'normal' as const },
    ],
  }
}
