// Markdown-lite (pure, client-safe): the format of every owner-edited document
// (házirend, ÁSZF, GYIK, Környék, adatkezelés). Deliberately tiny, so the owner's
// toolbar covers all of it and nothing can inject HTML:
//   ## Cím           heading
//   - tétel          bullet list
//   **félkövér**     bold
//   [szöveg](url)    link (https/mailto/tel only); bare https://… is linked too
//   blank line       new paragraph; a single newline stays a line break

export type Inline = { t: 'text'; v: string } | { t: 'b'; v: string } | { t: 'a'; v: string; href: string }
export type Block = { t: 'h'; id: string; v: Inline[]; text: string } | { t: 'p'; lines: Inline[][] } | { t: 'ul'; items: Inline[][] }

const SAFE_HREF = /^(https?:\/\/|mailto:|tel:)/i

export function slugify(s: string): string {
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 60)
}

export function parseInline(s: string): Inline[] {
  const out: Inline[] = []
  const re = /\*\*(.+?)\*\*|\[([^\]]+)\]\(([^)\s]+)\)|(https?:\/\/[^\s<>()]+[^\s<>().,;:!?])/g
  let last = 0
  for (let m; (m = re.exec(s)); ) {
    if (m.index > last) out.push({ t: 'text', v: s.slice(last, m.index) })
    if (m[1] != null) out.push({ t: 'b', v: m[1] })
    else if (m[2] != null) out.push(SAFE_HREF.test(m[3]) ? { t: 'a', v: m[2], href: m[3] } : { t: 'text', v: m[2] })
    else out.push({ t: 'a', v: m[4], href: m[4] })
    last = m.index + m[0].length
  }
  if (last < s.length) out.push({ t: 'text', v: s.slice(last) })
  return out
}

export function parseMarkdown(src: string): Block[] {
  const blocks: Block[] = []
  const used = new Map<string, number>()
  let para: string[] = []
  let list: string[] = []
  const flush = () => {
    if (para.length) blocks.push({ t: 'p', lines: para.map(parseInline) })
    if (list.length) blocks.push({ t: 'ul', items: list.map(parseInline) })
    para = []
    list = []
  }
  for (const raw of src.replace(/\r\n?/g, '\n').split('\n')) {
    const line = raw.trimEnd()
    if (!line.trim()) { flush(); continue }
    const h = /^#{2,3}\s+(.+)$/.exec(line)
    if (h) {
      flush()
      const text = h[1].trim()
      let id = slugify(text) || 'resz'
      const n = used.get(id) ?? 0
      used.set(id, n + 1)
      if (n) id = `${id}-${n + 1}`
      blocks.push({ t: 'h', id, v: parseInline(text), text })
      continue
    }
    const li = /^[-•]\s+(.+)$/.exec(line.trim())
    if (li) {
      if (para.length) { blocks.push({ t: 'p', lines: para.map(parseInline) }); para = [] }
      list.push(li[1])
      continue
    }
    if (list.length) { blocks.push({ t: 'ul', items: list.map(parseInline) }); list = [] }
    para.push(line.trim())
  }
  flush()
  return blocks
}

/** GYIK document -> Q&A pairs: each "## kérdés" heading, answer = the text until the next heading. */
export function parseFaq(src: string): { q: string; a: string }[] {
  const out: { q: string; a: string }[] = []
  let cur: { q: string; a: string[] } | null = null
  for (const raw of src.replace(/\r\n?/g, '\n').split('\n')) {
    const h = /^#{2,3}\s+(.+)$/.exec(raw.trim())
    if (h) {
      if (cur) out.push({ q: cur.q, a: cur.a.join('\n').trim() })
      cur = { q: h[1].trim(), a: [] }
    } else if (cur) cur.a.push(raw.trimEnd())
  }
  if (cur) out.push({ q: cur.q, a: cur.a.join('\n').trim() })
  return out.filter((f) => f.q && f.a)
}

/** Plain text (for JSON-LD answers, meta descriptions). */
export function plainText(src: string): string {
  return src
    .replace(/^#{2,3}\s+/gm, '')
    .replace(/^[-•]\s+/gm, '')
    .replace(/\*\*(.+?)\*\*/g, '$1')
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    .replace(/\s+/g, ' ')
    .trim()
}
