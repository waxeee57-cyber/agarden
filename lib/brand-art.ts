import 'server-only'
import { readFile } from 'node:fs/promises'
import { join } from 'node:path'

// Fonts for the host-aware image routes (app/brand/*): the vendored TTFs in
// assets/fonts, both verified to contain ő ű Ő Ű. The default ImageResponse
// font is not trusted with Hungarian accents.
export async function ogFonts() {
  const dir = join(process.cwd(), 'assets', 'fonts')
  const [display, sans] = await Promise.all([
    readFile(join(dir, 'Fraunces-Medium-144.ttf')),
    readFile(join(dir, 'HankenGrotesk-SemiBold.ttf')),
  ])
  return [
    { name: 'Fraunces', data: display, weight: 500 as const, style: 'normal' as const },
    { name: 'Hanken Grotesk', data: sans, weight: 600 as const, style: 'normal' as const },
  ]
}
