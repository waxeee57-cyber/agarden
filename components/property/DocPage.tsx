import { notFound } from 'next/navigation'
import type { Metadata } from 'next'
import { loadSite, type SiteCtx } from '@/lib/page'
import { parseMarkdown, plainText } from '@/lib/markdown'
import { huDate } from '@/lib/legal'
import type { DocKind } from '@/lib/terms'
import { SitePage, PageHead, pageMeta } from './SiteChrome'
import { MarkdownBlocks, Toc } from './Markdown'

// One owner-edited document as a page (házirend, Környék, …): heading, optional
// table of contents, the text. Missing document = 404 (the menu hides it too).

export async function docMeta(params: Promise<{ site: string }>, kind: DocKind, path: string, title: string, fallback: string): Promise<Metadata> {
  const ctx = await loadSite((await params).site)
  const body = ctx.docs[kind]?.body
  const desc = body ? plainText(body).slice(0, 155).replace(/\s\S*$/, '') + '…' : fallback
  return pageMeta(ctx.site, path, title, desc)
}

export async function DocPage({ params, kind, path, title, lead, extra, toggle }: { params: Promise<{ site: string }>; kind: DocKind; path: string; title: string; lead?: string; extra?: (ctx: SiteCtx) => React.ReactNode; toggle?: keyof SiteCtx['listing']['settings'] }) {
  const ctx = await loadSite((await params).site)
  const doc = ctx.docs[kind]
  // hidden from the menu by the owner = not published at all
  if (!doc || (toggle && !ctx.listing.settings[toggle])) notFound()
  return (
    <SitePage ctx={ctx} crumb={{ name: title, path }}>
      <DocBody title={title} lead={lead} body={doc.body} effective={doc.effectiveDate} updated={doc.updatedAt} />
      {extra?.(ctx)}
    </SitePage>
  )
}

export function DocBody({ title, lead, body, effective, updated }: { title: string; lead?: string; body: string; effective?: string | null; updated?: string | null }) {
  const blocks = parseMarkdown(body)
  const dateLine = effective ? `Hatályos: ${huDate(effective)}` : updated ? `Utoljára frissítve: ${huDate(updated)}` : null
  return (
    <>
      <PageHead title={title} lead={lead} />
      <div className="mx-auto grid max-w-7xl gap-10 px-4 pb-20 md:px-8 lg:grid-cols-[240px_1fr] lg:gap-16">
        <aside className="hidden lg:block"><div className="sticky top-6"><Toc blocks={blocks} /></div></aside>
        <article className="doc max-w-[70ch]">
          {dateLine && <p className="!mt-0 text-sm text-soft">{dateLine}</p>}
          <MarkdownBlocks blocks={blocks} />
        </article>
      </div>
    </>
  )
}
