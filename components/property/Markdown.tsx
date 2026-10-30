import { Fragment } from 'react'
import { parseMarkdown, type Inline, type Block } from '@/lib/markdown'

// Renders the owner's markdown-lite documents. Text only: no HTML from the
// document ever reaches the page (React escapes every string).

export function Inlines({ parts }: { parts: Inline[] }) {
  return (
    <>
      {parts.map((p, i) =>
        p.t === 'b' ? <strong key={i}>{p.v}</strong>
        : p.t === 'a' ? (
          <a key={i} href={p.href} {...(/^https?:/.test(p.href) ? { target: '_blank', rel: 'noopener noreferrer' } : {})}>{p.v}</a>
        ) : <Fragment key={i}>{p.v}</Fragment>
      )}
    </>
  )
}

export function MarkdownBlocks({ blocks }: { blocks: Block[] }) {
  return (
    <>
      {blocks.map((b, i) =>
        b.t === 'h' ? <h2 key={i} id={b.id} className="scroll-mt-6"><Inlines parts={b.v} /></h2>
        : b.t === 'ul' ? <ul key={i}>{b.items.map((it, j) => <li key={j}><Inlines parts={it} /></li>)}</ul>
        : <p key={i}>{b.lines.map((l, j) => <Fragment key={j}>{j > 0 && <br />}<Inlines parts={l} /></Fragment>)}</p>
      )}
    </>
  )
}

export function Markdown({ source }: { source: string }) {
  return <MarkdownBlocks blocks={parseMarkdown(source)} />
}

/** Table of contents from the document's headings (shown when there are ≥4). */
export function Toc({ blocks }: { blocks: Block[] }) {
  const heads = blocks.filter((b): b is Extract<Block, { t: 'h' }> => b.t === 'h')
  if (heads.length < 4) return null
  return (
    <nav aria-label="Tartalom" className="text-sm">
      <p className="text-xs font-semibold uppercase tracking-[0.16em] text-soft">Tartalom</p>
      <ol className="mt-3 space-y-0.5">
        {heads.map((h) => (
          <li key={h.id}><a href={`#${h.id}`} className="block py-1.5 text-fg/80 hover:text-pop">{h.text}</a></li>
        ))}
      </ol>
    </nav>
  )
}
