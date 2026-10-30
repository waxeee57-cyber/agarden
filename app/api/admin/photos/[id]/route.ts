import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { requireAdminApi } from '@/lib/admin/auth'
import { updatePhoto, deletePhoto } from '@/lib/photos'
import { revalidateSite } from '@/lib/admin/actions'
import { PHOTO_CATEGORIES } from '@/lib/terms'

const patchSchema = z.object({
  alt: z.string().max(200).optional(),
  isCover: z.literal(true).optional(),
  category: z.enum(PHOTO_CATEGORIES).optional(),
  featured: z.union([z.number().int().min(1).max(3), z.null()]).optional(),
})

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const a = await requireAdminApi(req)
  if (!a.ok) return a.res
  const { id } = await params
  const p = patchSchema.safeParse(await req.json().catch(() => null))
  if (!p.success || !z.guid().safeParse(id).success) return NextResponse.json({ ok: false, reason: 'validation_error' }, { status: 400 })
  const ok = await updatePhoto(a.session.listingId, id, p.data)
  if (ok) revalidateSite(a.session)
  return NextResponse.json({ ok }, { status: ok ? 200 : 404 })
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const a = await requireAdminApi(req)
  if (!a.ok) return a.res
  const { id } = await params
  if (!z.guid().safeParse(id).success) return NextResponse.json({ ok: false, reason: 'validation_error' }, { status: 400 })
  const ok = await deletePhoto(a.session.listingId, id)
  if (ok) revalidateSite(a.session)
  return NextResponse.json({ ok }, { status: ok ? 200 : 404 })
}
