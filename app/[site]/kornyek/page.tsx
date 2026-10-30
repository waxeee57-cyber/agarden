import { DocPage, docMeta } from '@/components/property/DocPage'

export const revalidate = 300

export function generateMetadata({ params }: { params: Promise<{ site: string }> }) {
  return docMeta(params, 'kornyek', '/kornyek', 'Környék & programok', 'Programok és látnivalók a Velencei-tó környékén.')
}

export default function Page({ params }: { params: Promise<{ site: string }> }) {
  return <DocPage params={params} kind="kornyek" path="/kornyek" title="Környék & programok" toggle="menuKornyek" />
}
