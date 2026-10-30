// scripts/import-photos.mjs — seed a house gallery from a local folder.
//
//   pnpm photos:import --site napsugar --dir <folder> --manifest db/photo-manifests/napsugar.json [--replace]
//
// Same pipeline as the admin upload (lib/photos.ts): sharp auto-rotate, max
// 1200 px, WebP q80, metadata stripped -> Vercel Blob (public) -> listing_photos.
// Manifest: [{ "file": "...", "alt": "...", "category": "kert"?, "featured": 1-3?, "cover": true? }, ...]
// in display order. --replace uploads the new set first and only then removes
// the old rows + blobs, so a failed run never leaves the gallery empty.
// Needs BLOB_READ_WRITE_TOKEN + DATABASE_URL_UNPOOLED (.env.local).

import { existsSync, readFileSync } from 'node:fs'
import { join, dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { randomUUID } from 'node:crypto'
import sharp from 'sharp'
import { put, del } from '@vercel/blob'
import pg from 'pg'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
if (existsSync(join(root, '.env.local'))) process.loadEnvFile(join(root, '.env.local'))

const args = process.argv.slice(2)
const arg = (name) => { const i = args.indexOf(`--${name}`); return i >= 0 ? args[i + 1] : undefined }
const site = arg('site')
const dir = arg('dir') && resolve(arg('dir'))
const manifestPath = arg('manifest') && resolve(root, arg('manifest'))
const replace = args.includes('--replace')

if (!['velence', 'napsugar'].includes(site ?? '') || !dir || !manifestPath) {
  console.error('usage: pnpm photos:import --site <velence|napsugar> --dir <folder> --manifest <json> [--replace]')
  process.exit(1)
}

const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'))
const db = new pg.Client({ connectionString: process.env.DATABASE_URL_UNPOOLED })
await db.connect()
try {
  const { rows } = await db.query("select id from listings where slug = $1 and status = 'active'", [site])
  if (!rows.length) throw new Error(`no active listing '${site}'`)
  const listingId = rows[0].id
  const existing = await db.query('select id, blob_url from listing_photos where listing_id = $1', [listingId])
  if (existing.rowCount && !replace) throw new Error(`${site} already has ${existing.rowCount} photos (use --replace)`)
  // old cover/featured flags would collide with the new set's unique indexes
  if (replace && existing.rowCount) await db.query('update listing_photos set is_cover = false, featured = null where listing_id = $1', [listingId])

  let i = 0
  for (const item of manifest) {
    const src = join(dir, item.file)
    const { data, info } = await sharp(readFileSync(src))
      .rotate()
      .resize({ width: 1200, height: 1200, fit: 'inside', withoutEnlargement: true })
      .webp({ quality: 80 })
      .toBuffer({ resolveWithObject: true })
    const meta = await sharp(data).metadata()
    if (meta.exif) throw new Error(`EXIF survived for ${item.file}`)
    const blob = await put(`listings/${site}/${randomUUID()}.webp`, data, { access: 'public', contentType: 'image/webp', addRandomSuffix: false })
    await db.query(
      `insert into listing_photos (listing_id, blob_url, width, height, alt, sort_order, is_cover, category, featured)
       values ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
      [listingId, blob.url, info.width, info.height, item.alt, i, !!item.cover, item.category ?? 'egyeb', item.featured ?? null]
    )
    console.log(`photos:import ${site} ${String(++i).padStart(2, '0')}/${manifest.length} ${info.width}x${info.height} ${(data.length / 1024).toFixed(0)} KB${item.cover ? ' (cover)' : ''}`)
  }
  if (replace && existing.rowCount) {
    await db.query('delete from listing_photos where id = any($1::uuid[])', [existing.rows.map((r) => r.id)])
    for (const r of existing.rows) await del(r.blob_url).catch(() => {})
    console.log(`photos:import ${site} removed ${existing.rowCount} old photos`)
  }
} finally {
  await db.end()
}
