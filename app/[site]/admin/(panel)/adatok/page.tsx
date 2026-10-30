import { notFound } from 'next/navigation'
import { requireAdminPage } from '@/lib/admin/guard'
import { getAdminListing, getAdminSettings } from '@/lib/admin/data'
import { LegalForm } from '@/components/admin/LegalForm'
import { SettingsForm } from '@/components/admin/SettingsForm'

export default async function AdminLegal({ params }: { params: Promise<{ site: string }> }) {
  const session = await requireAdminPage(params)
  const [listing, settings] = await Promise.all([getAdminListing(session.listingId), getAdminSettings(session.listingId)])
  if (!listing || !settings) notFound()
  return (
    <div className="space-y-12">
      <section>
        <h1 className="text-3xl">Adatok és beállítások</h1>
        <p className="mb-6 mt-2 max-w-3xl text-muted">Közösségi linkek, menüpontok, előleg és lemondás. Mentés után azonnal élesben.</p>
        <SettingsForm initial={settings} />
      </section>
      <section>
        <h2 className="text-2xl">Üzemeltetői és jogi adatok</h2>
        <p className="mb-6 mt-2 max-w-3xl text-muted">
          Ezek kerülnek az ÁSZF-be és az adatkezelési tájékoztatóba (ha nincs saját szöveged). Részletekben is kitöltheted:
          ami még üres, ott „pótlásra vár” jelölés marad.
        </p>
        <LegalForm listing={listing} />
      </section>
    </div>
  )
}
