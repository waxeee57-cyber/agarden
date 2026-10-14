import { requireAdminPage } from '@/lib/admin/guard'
import { listOccupancy } from '@/lib/admin/data'
import { OccupancyBoard } from '@/components/admin/OccupancyBoard'

const pad = (n: number) => String(n).padStart(2, '0')

export default async function AdminCalendar({ params }: { params: Promise<{ site: string }> }) {
  const session = await requireAdminPage(params)
  const now = new Date()
  const months = Array.from({ length: 6 }, (_, i) => {
    const d = new Date(now.getFullYear(), now.getMonth() + i, 1)
    return { y: d.getFullYear(), m: d.getMonth() }
  })
  const from = `${months[0].y}-${pad(months[0].m + 1)}-01`
  const end = new Date(now.getFullYear(), now.getMonth() + 6, 1)
  const to = `${end.getFullYear()}-${pad(end.getMonth() + 1)}-01`
  const rows = await listOccupancy(session.listingId, from, to)
  return (
    <div>
      <h1 className="text-3xl">Foglaltsági naptár</h1>
      <p className="mt-1 mb-6 text-sm text-muted">A következő 6 hónap. A foglalások a Foglalások fülön igazolhatók vissza vagy mondhatók le.</p>
      <OccupancyBoard rows={rows} months={months} />
    </div>
  )
}
