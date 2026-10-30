import { NextRequest, NextResponse } from 'next/server'
import { requireAdminApi } from '@/lib/admin/auth'
import { storePhoto, reorderPhotos, MAX_UPLOAD_BYTES } from '@/lib/photos'
import { revalidateSite } from '@/lib/admin/actions'
import { PHOTO_CATEGORIES } from '@/lib/terms'

export const maxDuration = 60

// POST multipart { file, alt } -> sharp -> Blob -> listing_photos.
// The admin UI downsizes in the browser first (Vercel request body limit 4.5 MB).
export async function POST(req: NextRequest) {
  const a = await requireAdminApi(req)
  if (!a.ok) return a.res
  const form = await req.formData().catch(() => null)
  const file = form?.get('file')
  const alt = String(form?.get('alt') ?? '').slice(0, 200)
  const cat = String(form?.get('category') ?? 'egyeb')
  const category = (PHOTO_CATEGORIES as readonly string[]).includes(cat) ? cat : 'egyeb'
  if (!(file instanceof File) || file.size === 0) return NextResponse.json({ ok: false, reason: 'validation_error' }, { status: 400 })
  if (file.size > MAX_UPLOAD_BYTES) return NextResponse.json({ ok: false, reason: 'too_large' }, { status: 413 })
  if (!/^image\/(jpeg|png|webp|avif|heic|heif)$/.test(file.type)) return NextResponse.json({ ok: false, reason: 'unsupported_type' }, { status: 415 })
  try {
    const photo = await storePhoto(a.session.listingId, a.session.site, Buffer.from(await file.arrayBuffer()), alt, category)
    revalidateSite(a.session)
    return NextResponse.json({ ok: true, photo })
  } catch (e) {
    console.error('[photos:upload]', e instanceof Error ? e.message : e)
    return NextResponse.json({ ok: false, reason: 'processing_failed' }, { status: 422 })
  }
}

// PUT { ids: string[] } — new display order.
export async function PUT(req: NextRequest) {
  const a = await requireAdminApi(req)
  if (!a.ok) return a.res
  const body = (await req.json().catch(() => null)) as { ids?: unknown } | null
  const ids = Array.isArray(body?.ids) ? body.ids.filter((x): x is string => typeof x === 'string') : []
  const ok = await reorderPhotos(a.session.listingId, ids)
  if (ok) revalidateSite(a.session)
  return NextResponse.json({ ok }, { status: ok ? 200 : 400 })
}
