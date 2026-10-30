import 'server-only'
import { randomUUID } from 'node:crypto'
import sharp from 'sharp'
import { put, del } from '@vercel/blob'
import { query, queryOne, tx } from './db'

// Photo pipeline: upload -> sharp (auto-rotate, max 1200 px, WebP, metadata
// stripped — sharp drops EXIF/GPS unless .withMetadata() is called) ->
// Vercel Blob (public) -> listing_photos row. Same steps as
// scripts/import-photos.mjs, which seeds the initial galleries.

export const MAX_UPLOAD_BYTES = 15 * 1024 * 1024

export async function storePhoto(listingId: string, slug: string, input: Buffer, alt: string, category = 'egyeb') {
  const { data, info } = await sharp(input, { failOn: 'error' })
    .rotate()
    .resize({ width: 1200, height: 1200, fit: 'inside', withoutEnlargement: true })
    .webp({ quality: 80 })
    .toBuffer({ resolveWithObject: true })

  const blob = await put(`listings/${slug}/${randomUUID()}.webp`, data, {
    access: 'public',
    contentType: 'image/webp',
    addRandomSuffix: false,
  })
  const next = await queryOne<{ n: number }>('select coalesce(max(sort_order), -1) + 1 as n from listing_photos where listing_id = $1', [listingId])
  const hasCover = await queryOne<{ c: boolean }>('select exists(select 1 from listing_photos where listing_id = $1 and is_cover) as c', [listingId])
  const row = await queryOne<{ id: string }>(
    `insert into listing_photos (listing_id, blob_url, width, height, alt, sort_order, is_cover, category)
     values ($1, $2, $3, $4, $5, $6, $7, $8) returning id`,
    [listingId, blob.url, info.width, info.height, alt.trim(), next?.n ?? 0, !hasCover?.c, category]
  )
  return { id: row!.id, url: blob.url, width: info.width, height: info.height }
}

export async function updatePhoto(listingId: string, photoId: string, patch: { alt?: string; isCover?: boolean; category?: string; featured?: number | null }) {
  return tx(async (c) => {
    const own = await c.query('select 1 from listing_photos where id = $1 and listing_id = $2', [photoId, listingId])
    if (!own.rowCount) return false
    if (patch.alt !== undefined) await c.query('update listing_photos set alt = $1 where id = $2', [patch.alt.trim(), photoId])
    if (patch.category !== undefined) await c.query('update listing_photos set category = $1 where id = $2', [patch.category, photoId])
    if (patch.featured !== undefined) {
      // a slot holds one photo: free it first (partial unique index), then take it
      if (patch.featured != null) await c.query('update listing_photos set featured = null where listing_id = $1 and featured = $2', [listingId, patch.featured])
      await c.query('update listing_photos set featured = $1 where id = $2', [patch.featured, photoId])
    }
    if (patch.isCover) {
      await c.query('update listing_photos set is_cover = false where listing_id = $1 and is_cover', [listingId])
      await c.query('update listing_photos set is_cover = true where id = $1', [photoId])
    }
    return true
  })
}

/** Persist a new order: ids in display order (all must belong to the listing). */
export async function reorderPhotos(listingId: string, ids: string[]) {
  return tx(async (c) => {
    const owned = await c.query<{ id: string }>('select id from listing_photos where listing_id = $1', [listingId])
    const set = new Set(owned.rows.map((r) => r.id))
    if (ids.length !== set.size || !ids.every((id) => set.has(id))) return false
    for (let i = 0; i < ids.length; i++) await c.query('update listing_photos set sort_order = $1 where id = $2', [i, ids[i]])
    return true
  })
}

export async function deletePhoto(listingId: string, photoId: string) {
  const rows = await query<{ blob_url: string; is_cover: boolean }>(
    'delete from listing_photos where id = $1 and listing_id = $2 returning blob_url, is_cover',
    [photoId, listingId]
  )
  if (!rows.length) return false
  if (rows[0].is_cover) {
    await query(
      `update listing_photos set is_cover = true where id = (
         select id from listing_photos where listing_id = $1 order by sort_order, created_at limit 1)`,
      [listingId]
    )
  }
  try {
    await del(rows[0].blob_url)
  } catch (e) {
    console.error('[photos] blob delete failed', e instanceof Error ? e.message : e)
  }
  return true
}
