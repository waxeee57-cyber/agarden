import { notFound } from 'next/navigation'
import { requireAdminPage } from '@/lib/admin/guard'
import { getAdminListing } from '@/lib/admin/data'
import { PricingForm } from '@/components/admin/PricingForm'

export default async function AdminPricing({ params }: { params: Promise<{ site: string }> }) {
  const session = await requireAdminPage(params)
  const listing = await getAdminListing(session.listingId)
  if (!listing) notFound()
  return (
    <div>
      <h1 className="mb-6 text-3xl">Árak és felárak</h1>
      <PricingForm listing={listing} />
    </div>
  )
}
