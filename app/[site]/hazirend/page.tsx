import { DocPage, docMeta } from '@/components/property/DocPage'

export const revalidate = 300

export function generateMetadata({ params }: { params: Promise<{ site: string }> }) {
  return docMeta(params, 'hazirend', '/hazirend', 'Házirend', 'A vendégház házirendje: érkezés, távozás, csendes pihenő, fizetés és a wellness használata.')
}

export default function Page({ params }: { params: Promise<{ site: string }> }) {
  return <DocPage params={params} kind="hazirend" path="/hazirend" title="Házirend" lead="Érkezés előtt érdemes végigolvasni: így senkit nem ér meglepetés." />
}
