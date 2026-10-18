import { requireAdminPage } from '@/lib/admin/guard'
import { listBookings, bookingCounts, FILTERS, type FilterKey } from '@/lib/admin/data'
import { getListing } from '@/lib/listing'
import { BookingsBoard } from '@/components/admin/BookingsBoard'
import { ManualBookingForm } from '@/components/admin/ManualBookingForm'
import { emailEnabled } from '@/lib/email/send'

export default async function AdminBookings({ params, searchParams }: { params: Promise<{ site: string }>; searchParams: Promise<{ szuro?: string }> }) {
  const session = await requireAdminPage(params)
  const { szuro } = await searchParams
  const filter: FilterKey = szuro && szuro in FILTERS ? (szuro as FilterKey) : 'uj'
  const [bookings, counts, listing] = await Promise.all([
    listBookings(session.listingId, filter),
    bookingCounts(session.listingId),
    getListing(session.site),
  ])
  const filters = (Object.keys(FILTERS) as FilterKey[]).map((key) => ({
    key,
    label: FILTERS[key].label,
    count: key === 'uj' ? counts.pending + counts.quote_request : key === 'visszaigazolt' ? counts.confirmed : null,
  }))
  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl">Foglalások és ajánlatkérések</h1>
          <p className="mt-1 text-sm text-muted">{session.listingName}</p>
        </div>
        <ManualBookingForm maxGuests={(listing?.capacityMax ?? 1) + (listing?.capacityExtra ?? 0)} />
      </div>
      <BookingsBoard bookings={bookings} filters={filters} current={filter} emailOn={emailEnabled()} />
    </div>
  )
}
