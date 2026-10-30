import Link from 'next/link'
import { notFound } from 'next/navigation'
import { requireAdminPage } from '@/lib/admin/guard'
import { getAdminListing, listDocuments } from '@/lib/admin/data'
import { DOC_KINDS, DOC_LABEL, type DocKind } from '@/lib/terms'
import { ContentForm } from '@/components/admin/ContentForm'
import { DocEditor } from '@/components/admin/DocEditor'

const PATHS: Record<DocKind, string> = { hazirend: '/hazirend', aszf: '/aszf', gyik: '/gyik', kornyek: '/kornyek', adatvedelem: '/adatvedelem' }
const TABS = [['bemutatkozas', 'Főoldal, kapcsolat'], ...DOC_KINDS.map((k) => [k, DOC_LABEL[k]])] as [string, string][]

export default async function AdminTexts({ params, searchParams }: { params: Promise<{ site: string }>; searchParams: Promise<{ doc?: string }> }) {
  const session = await requireAdminPage(params)
  const { doc = 'hazirend' } = await searchParams
  const current = TABS.some(([k]) => k === doc) ? doc : 'hazirend'
  const [listing, docs] = await Promise.all([getAdminListing(session.listingId), listDocuments(session.listingId)])
  if (!listing) notFound()
  return (
    <div>
      <h1 className="text-3xl">Szövegek</h1>
      <p className="mt-1 text-sm text-muted">Mentés után a weboldalon azonnal az új szöveg látszik. Minden mentés visszaállítható.</p>
      <nav aria-label="Szöveg kiválasztása" className="-mx-4 mt-5 overflow-x-auto px-4">
        <ul className="flex gap-1.5">
          {TABS.map(([k, label]) => (
            <li key={k}>
              <Link href={`/admin/szovegek?doc=${k}`} aria-current={k === current ? 'page' : undefined} className={`inline-flex min-h-12 items-center whitespace-nowrap rounded-full border px-4 text-sm font-semibold ${k === current ? 'border-deep bg-deep text-cream' : 'border-line bg-cream text-deep'}`}>
                {label}
              </Link>
            </li>
          ))}
        </ul>
      </nav>
      <div className="mt-6">
        {current === 'bemutatkozas' ? (
          <ContentForm listing={listing} />
        ) : (
          <DocEditor
            key={current}
            kind={current as DocKind}
            label={DOC_LABEL[current as DocKind]}
            path={PATHS[current as DocKind]}
            initial={docs[current as DocKind] ?? { body: '', effectiveDate: null, updatedAt: null }}
            withDate={current === 'aszf' || current === 'adatvedelem' || current === 'hazirend'}
          />
        )}
      </div>
    </div>
  )
}
