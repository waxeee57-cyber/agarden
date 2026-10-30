import { notFound } from 'next/navigation'
import Link from 'next/link'
import { loadSite } from '@/lib/page'
import { parseFaq } from '@/lib/markdown'
import { telHref } from '@/lib/brand'
import { SitePage, PageHead, pageMeta } from '@/components/property/SiteChrome'
import { JsonLd, faqJsonLd } from '@/components/property/JsonLd'
import { Markdown } from '@/components/property/Markdown'

export const revalidate = 300

export async function generateMetadata({ params }: { params: Promise<{ site: string }> }) {
  const ctx = await loadSite((await params).site)
  const n = parseFaq(ctx.docs.gyik?.body ?? '').length
  return pageMeta(ctx.site, '/gyik', 'Gyakori kérdések', `${n} kérdés és válasz: létszám, minimum éjszakák, fizetés, kisállat, parkolás és a wellness használata.`)
}

export default async function Page({ params }: { params: Promise<{ site: string }> }) {
  const ctx = await loadSite((await params).site)
  // hidden from the menu by the owner = not published at all
  if (!ctx.listing.settings.menuGyik || !ctx.docs.gyik) notFound()
  const faq = parseFaq(ctx.docs.gyik.body)
  if (!faq.length) notFound()
  return (
    <SitePage ctx={ctx} crumb={{ name: 'GYIK', path: '/gyik' }}>
      <JsonLd data={faqJsonLd(faq.map((f) => ({ q: f.q, a: f.a.replace(/\*\*|\[|\]\([^)]*\)/g, '') })))} />
      <PageHead title="Gyakori kérdések" />
      <div className="mx-auto max-w-7xl px-4 pb-20 md:px-8">
        <div className="max-w-3xl divide-y divide-rule border-y border-rule">
          {faq.map((f) => (
            <details key={f.q} className="group">
              <summary className="flex min-h-16 cursor-pointer list-none items-center justify-between gap-6 py-4 text-lg font-semibold [&::-webkit-details-marker]:hidden">
                {f.q}
                <span aria-hidden="true" className="text-2xl text-pop transition-transform group-open:rotate-45">+</span>
              </summary>
              <div className="doc pb-6 pr-10"><Markdown source={f.a} /></div>
            </details>
          ))}
        </div>
        <p className="mt-10 text-soft">
          Nem találtad a választ? Hívj: <a href={telHref(ctx.phone)} className="font-semibold text-fg underline underline-offset-4">{ctx.phone}</a>, vagy írj a{' '}
          <Link href="/kapcsolat" className="font-semibold text-fg underline underline-offset-4">Kapcsolat</Link> oldalon.
        </p>
      </div>
    </SitePage>
  )
}
