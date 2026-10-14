import { requireAdminPage } from '@/lib/admin/guard'
import { getPhotos } from '@/lib/listing'
import { PhotoManager } from '@/components/admin/PhotoManager'

export default async function AdminPhotos({ params }: { params: Promise<{ site: string }> }) {
  const session = await requireAdminPage(params)
  const photos = await getPhotos(session.listingId)
  return (
    <div>
      <h1 className="text-3xl">Fotók</h1>
      <p className="mb-6 mt-1 text-sm text-muted">{photos.length} fotó. A borítókép a főkép, a többi a galériában jelenik meg, ebben a sorrendben.</p>
      <PhotoManager photos={photos} />
    </div>
  )
}
