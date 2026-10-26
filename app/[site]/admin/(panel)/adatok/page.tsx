import { notFound } from 'next/navigation'
import { requireAdminPage } from '@/lib/admin/guard'
import { getAdminListing } from '@/lib/admin/data'
import { LegalForm } from '@/components/admin/LegalForm'

export default async function AdminLegal({ params }: { params: Promise<{ site: string }> }) {
  const session = await requireAdminPage(params)
  const listing = await getAdminListing(session.listingId)
  if (!listing) notFound()
  return (
    <div>
      <h1 className="text-3xl">Szükséges adatok</h1>
      <p className="mb-6 mt-2 max-w-3xl text-muted">
        Ezek kerülnek az ÁSZF-be és az adatkezelési tájékoztatóba. Részletekben is kitöltheted: amit mentesz, az azonnal megjelenik az oldalon,
        ami még üres, ott „pótlásra vár” jelölés marad.
      </p>
      <LegalForm listing={listing} />
    </div>
  )
}
