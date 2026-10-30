import 'server-only'
import { readFile } from 'node:fs/promises'
import { join } from 'node:path'

// Fonts for the host-aware image routes (app/brand/*): vendored TTFs in
// assets/fonts, each verified to contain ő ű Ő Ű (fontTools cmap check,
// 2026-10-30). The default ImageResponse font is not trusted with Hungarian accents.
export async function ogFonts() {
  const dir = join(process.cwd(), 'assets', 'fonts')
  const [display, sans] = await Promise.all([readFile(join(dir, 'YoungSerif-Regular.ttf')), readFile(join(dir, 'SchibstedGrotesk-Regular.ttf'))])
  return {
    displayName: 'Young Serif',
    sansName: 'Schibsted Grotesk',
    fonts: [
      { name: 'Young Serif', data: display, weight: 400 as const, style: 'normal' as const },
      { name: 'Schibsted Grotesk', data: sans, weight: 400 as const, style: 'normal' as const },
    ],
  }
}
