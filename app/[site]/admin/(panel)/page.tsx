import Link from 'next/link'
import { requireAdminPage } from '@/lib/admin/guard'
import { listBookings, bookingCounts, listMessages, getAdminSettings, FILTERS, type FilterKey } from '@/lib/admin/data'
import { getListing, getPhotos } from '@/lib/listing'
import { BookingsBoard } from '@/components/admin/BookingsBoard'
import { ManualBookingForm } from '@/components/admin/ManualBookingForm'
import { MessagesBoard } from '@/components/admin/MessagesBoard'
import { emailEnabled } from '@/lib/email/send'
import { missingLegal } from '@/lib/legal'

type Todo = { text: string; href: string; action: string; urgent?: boolean }

export default async function AdminBookings({ params, searchParams }: { params: Promise<{ site: string }>; searchParams: Promise<{ szuro?: string }> }) {
  const session = await requireAdminPage(params)
  const { szuro } = await searchParams
  const filter: FilterKey = szuro && szuro in FILTERS ? (szuro as FilterKey) : 'uj'
  const [bookings, counts, listing, messages, settings] = await Promise.all([
    listBookings(session.listingId, filter),
    bookingCounts(session.listingId),
    getListing(session.site),
    listMessages(session.listingId),
    getAdminSettings(session.listingId),
  ])
  const photos = listing ? await getPhotos(listing.id) : []
  const filters = (Object.keys(FILTERS) as FilterKey[]).map((key) => ({
    key,
    label: FILTERS[key].label,
    count: key === 'uj' ? counts.pending + counts.quote_request : key === 'visszaigazolt' ? counts.confirmed : null,
  }))

  // "Mi a teendőd?" — only real, actionable items, most urgent first.
  const todos: Todo[] = []
  const fresh = counts.pending + counts.quote_request
  if (fresh) todos.push({ text: `${fresh} új foglalási kérelem vagy ajánlatkérés vár válaszra.`, href: '/admin?szuro=uj#foglalasok', action: 'Megnézem', urgent: true })
  const unread = messages.filter((m) => !m.handled).length
  if (unread) todos.push({ text: `${unread} megválaszolatlan üzenet a Kapcsolat oldalról.`, href: '#uzenetek', action: 'Elolvasom', urgent: true })
  if (settings?.terms.depositPct && !settings.bankAccount) todos.push({ text: 'Nincs megadva bankszámlaszám az előleghez: a visszaigazoló levélben most „egyeztetjük” áll.', href: '/admin/adatok', action: 'Megadom' })
  const missing = listing ? missingLegal(listing.legal, listing).length : 0
  if (missing) todos.push({ text: `${missing} üzemeltetői adat hiányzik a generált jogi oldalakból.`, href: '/admin/adatok', action: 'Kitöltöm' })
  const noAlt = photos.filter((p) => !p.alt.trim()).length
  if (noAlt) todos.push({ text: `${noAlt} fotónak nincs leírása.`, href: '/admin/fotok', action: 'Pótolom' })
  const mailOff = !emailEnabled()

  return (
    <div className="space-y-10">
      <section aria-labelledby="todo-title" className="card p-5 md:p-6">
        <h1 id="todo-title" className="text-2xl">Mi a teendőd?</h1>
        {todos.length === 0 ? (
          <p className="mt-2 text-success font-semibold">Minden rendben, most nincs teendőd.</p>
        ) : (
          <ul className="mt-3 divide-y divide-line">
            {todos.map((t) => (
              <li key={t.text} className="flex flex-wrap items-center justify-between gap-3 py-3">
                <span className={t.urgent ? 'font-semibold' : ''}>{t.urgent && <span aria-hidden="true" className="mr-2 inline-block h-2.5 w-2.5 rounded-full bg-action" />}{t.text}</span>
                <Link href={t.href} className="btn btn-ghost btn-sm">{t.action}</Link>
              </li>
            ))}
          </ul>
        )}
        {mailOff && <p className="mt-3 text-sm text-muted">Az automatikus e-mailek ki vannak kapcsolva: a vendéget telefonon vagy saját e-mailből értesítsd a visszaigazolásról.</p>}
      </section>

      <section id="foglalasok" className="scroll-mt-4 space-y-6">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h2 className="text-3xl">Foglalások és ajánlatkérések</h2>
            <p className="mt-1 text-sm text-muted">{session.listingName}</p>
          </div>
          <ManualBookingForm maxGuests={(listing?.capacityMax ?? 1) + (listing?.capacityExtra ?? 0)} />
        </div>
        <BookingsBoard bookings={bookings} filters={filters} current={filter} emailOn={!mailOff} />
      </section>

      <section id="uzenetek" aria-labelledby="uz-title" className="scroll-mt-4">
        <h2 id="uz-title" className="mb-4 text-2xl">Üzenetek</h2>
        <MessagesBoard messages={messages} />
      </section>
    </div>
  )
}
