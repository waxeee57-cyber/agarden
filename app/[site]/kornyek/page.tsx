import { DocPage, docMeta } from '@/components/property/DocPage'

export const revalidate = 86400 // content changes revalidate on save (admin); this is only a safety net

export function generateMetadata({ params }: { params: Promise<{ site: string }> }) {
  return docMeta(params, 'kornyek', '/kornyek', 'Környék & programok', 'Programok és látnivalók a Velencei-tó környékén.')
}

export default function Page({ params }: { params: Promise<{ site: string }> }) {
  return <DocPage params={params} kind="kornyek" path="/kornyek" title="Környék & programok" toggle="menuKornyek" />
}
