import { loadSite } from '@/lib/page'
import { getPhotos } from '@/lib/listing'
import { PHOTO_CATEGORIES, PHOTO_CATEGORY_LABEL } from '@/lib/terms'
import { SitePage, PageHead, pageMeta } from '@/components/property/SiteChrome'
import { Gallery } from '@/components/property/Gallery'

export const revalidate = 300

export async function generateMetadata({ params }: { params: Promise<{ site: string }> }) {
  const ctx = await loadSite((await params).site)
  const photos = await getPhotos(ctx.listing.id)
  return pageMeta(ctx.site, '/kepek', 'Képek', `${photos.length} valódi fotó a házról: wellness, kert, nappali, hálószobák, fürdőszobák.`)
}

export default async function Page({ params }: { params: Promise<{ site: string }> }) {
  const ctx = await loadSite((await params).site)
  const photos = await getPhotos(ctx.listing.id)
  const groups = PHOTO_CATEGORIES.map((c) => ({ key: c, label: PHOTO_CATEGORY_LABEL[c], items: photos.filter((p) => p.category === c) })).filter((g) => g.items.length)
  return (
    <SitePage ctx={ctx} crumb={{ name: 'Képek', path: '/kepek' }}>
      <PageHead title="Képek" lead={`${photos.length} fotó, mind a házról készült.`} />
      <div className="mx-auto max-w-7xl px-4 pb-20 md:px-8">
        {groups.length > 1 && (
          <nav aria-label="Kategóriák" className="sticky top-0 z-20 -mx-4 mb-6 overflow-x-auto bg-bg/95 px-4 py-3 backdrop-blur md:-mx-8 md:px-8">
            <ul className="flex gap-2">
              {groups.map((g) => (
                <li key={g.key}>
                  <a href={`#${g.key}`} className="inline-flex min-h-11 items-center whitespace-nowrap rounded-full border border-rule bg-surface px-4 text-sm font-semibold hover:border-fg">
                    {g.label} <span className="ml-2 text-soft tnum">{g.items.length}</span>
                  </a>
                </li>
              ))}
            </ul>
          </nav>
        )}
        {groups.map((g) => (
          <section key={g.key} id={g.key} aria-labelledby={`${g.key}-t`} className="scroll-mt-20 pb-12">
            <h2 id={`${g.key}-t`} className="mb-5 text-[clamp(1.6rem,3vw,2.2rem)]">{g.label}</h2>
            <Gallery items={g.items} />
          </section>
        ))}
        {!photos.length && <p className="text-soft">A fotók feltöltés alatt.</p>}
      </div>
    </SitePage>
  )
}
