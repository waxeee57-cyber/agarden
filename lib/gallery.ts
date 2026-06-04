import { readdir } from 'node:fs/promises'
import { join } from 'node:path'

// Gallery photos live in public/velence/ with a stable convention so the owner
// can drop in their own files and they appear automatically:
//
//   public/velence/velence-hero.jpg   -> full-bleed hero background (optional)
//   public/velence/velence-01.jpg     -> gallery slot 1
//   public/velence/velence-02.jpg     -> gallery slot 2
//   … up to velence-08.(jpg|jpeg|png|webp)
//
// Missing files render an intentional, on-brand placeholder (see Gallery.tsx).

const EXTS = ['jpg', 'jpeg', 'png', 'webp', 'avif']

// Labels map slots to the real spaces from the brief (no invented features).
const SLOT_LABELS = [
  'Emelet — 4 hálószoba',
  'Nappali & étkező',
  'Konyha',
  'Fedett terasz',
  '6 fős jakuzzi',
  '2 fős szauna',
  'Kert, grill & bogrács',
  'Erkély & kilátás',
]

export type GalleryData = {
  hero: string | null
  items: { id: string; src: string | null; label: string }[]
}

async function listFiles(): Promise<Set<string>> {
  try {
    return new Set(await readdir(join(process.cwd(), 'public', 'velence')))
  } catch {
    return new Set()
  }
}

function find(files: Set<string>, base: string): string | null {
  for (const ext of EXTS) {
    const name = `${base}.${ext}`
    if (files.has(name)) return `/velence/${name}`
  }
  return null
}

export async function getVelenceGallery(): Promise<GalleryData> {
  const files = await listFiles()
  const hero = find(files, 'velence-hero')
  const items = SLOT_LABELS.map((label, i) => {
    const n = String(i + 1).padStart(2, '0')
    return { id: `slot-${n}`, src: find(files, `velence-${n}`), label }
  })
  return { hero, items }
}
