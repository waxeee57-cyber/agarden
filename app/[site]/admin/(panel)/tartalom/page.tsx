import { notFound } from 'next/navigation'
import { requireAdminPage } from '@/lib/admin/guard'
import { getAdminListing } from '@/lib/admin/data'
import { ContentForm } from '@/components/admin/ContentForm'

export default async function AdminContent({ params }: { params: Promise<{ site: string }> }) {
  const session = await requireAdminPage(params)
  const listing = await getAdminListing(session.listingId)
  if (!listing) notFound()
  return (
    <div>
      <h1 className="mb-6 text-3xl">Tartalom</h1>
      <ContentForm listing={listing} />
    </div>
  )
}
