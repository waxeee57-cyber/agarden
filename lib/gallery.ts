import { readdir } from 'node:fs/promises'
import { join } from 'node:path'

// Gallery is DATA-DRIVEN by the contents of public/velence/. The owner just
// drops files in — every photo appears automatically, in name order:
//
//   public/velence/velence-hero.(jpg|jpeg|png|webp|avif)  -> full-bleed hero (optional)
//   public/velence/velence-*.(jpg|jpeg|png|webp|avif)     -> gallery photos
//
// Matching is case-insensitive and accepts any `velence-<anything>` name, so
// velence-01.jpg, velence-2.JPG, velence-terasz.webp all work. No fixed slot
// count → no "coming soon" placeholders.

const EXT_RE = /\.(jpe?g|png|webp|avif)$/i

export type GalleryData = {
  hero: string | null
  items: { id: string; src: string; label: string }[]
}

// Natural sort so velence-2 sorts before velence-10.
const naturalCompare = (a: string, b: string) =>
  a.localeCompare(b, 'hu', { numeric: true, sensitivity: 'base' })

export async function getVelenceGallery(): Promise<GalleryData> {
  let files: string[]
  try {
    files = await readdir(join(process.cwd(), 'public', 'velence'))
  } catch {
    return { hero: null, items: [] }
  }

  const isImage = (f: string) => EXT_RE.test(f) && /^velence-/i.test(f)
  const isHero = (f: string) => /^velence-hero\./i.test(f)

  const hero = files.find(isHero)
  const photos = files.filter((f) => isImage(f) && !isHero(f)).sort(naturalCompare)

  return {
    hero: hero ? `/velence/${hero}` : null,
    items: photos.map((file, i) => ({
      id: file,
      src: `/velence/${file}`,
      label: `Garden Vendégház Velence — ${i + 1}`,
    })),
  }
}
