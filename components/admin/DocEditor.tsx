'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import type { DocKind } from '@/lib/terms'
import type { DocVersion } from '@/lib/admin/data'
import { Markdown } from '@/components/property/Markdown'
import { adminFetch, reasonText } from './client'

// Owner's editor for one document. Markdown-lite only (## cím, **félkövér**,
// - lista, [szöveg](link)), so the toolbar covers everything and nothing can
// break the page. Every save is a version; the last 20 can be restored.

const HINT: Record<DocKind, string> = {
  hazirend: 'Fejezetcímekkel (##) tagolva a vendég gyorsan megtalálja, amit keres.',
  aszf: 'Amíg ez üres, az oldal az „Adatok” fülből generált ÁSZF-et mutatja.',
  gyik: 'Minden kérdés egy ## címsor, alatta a válasz. Így kerül a Google-be is kérdés-válaszként.',
  kornyek: 'Programok, látnivalók, hasznos linkek. Üresen a menüpont nem jelenik meg.',
  adatvedelem: 'A saját tájékoztatód. Alatta a honlap foglalási rendszerének adatkezelése automatikusan megjelenik.',
}

export function DocEditor({ kind, label, path, initial, withDate }: { kind: DocKind; label: string; path: string; initial: { body: string; effectiveDate: string | null; updatedAt: string | null }; withDate: boolean }) {
  const [body, setBody] = useState(initial.body)
  const [date, setDate] = useState(initial.effectiveDate ?? '')
  const [saved, setSaved] = useState({ body: initial.body, date: initial.effectiveDate ?? '', at: initial.updatedAt })
  const [tab, setTab] = useState<'edit' | 'preview'>('edit')
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null)
  const [saving, setSaving] = useState(false)
  const [versions, setVersions] = useState<DocVersion[] | null>(null)
  const ta = useRef<HTMLTextAreaElement>(null)
  const dirty = body !== saved.body || date !== saved.date

  // unsaved-changes warning: browser close/reload and in-app links
  useEffect(() => {
    if (!dirty) return
    const onUnload = (e: BeforeUnloadEvent) => { e.preventDefault() }
    const onClick = (e: MouseEvent) => {
      const a = (e.target as HTMLElement).closest('a')
      if (a && a.href && !a.target && !window.confirm('Mentetlen változtatásaid vannak. Biztosan elhagyod az oldalt?')) { e.preventDefault(); e.stopPropagation() }
    }
    window.addEventListener('beforeunload', onUnload)
    document.addEventListener('click', onClick, true)
    return () => { window.removeEventListener('beforeunload', onUnload); document.removeEventListener('click', onClick, true) }
  }, [dirty])

  function wrap(before: string, after = '', placeholder = 'szöveg') {
    const el = ta.current
    if (!el) return
    const { selectionStart: s, selectionEnd: e } = el
    const sel = body.slice(s, e) || placeholder
    const next = body.slice(0, s) + before + sel + after + body.slice(e)
    setBody(next)
    requestAnimationFrame(() => { el.focus(); el.setSelectionRange(s + before.length, s + before.length + sel.length) })
  }
  function linePrefix(prefix: string) {
    const el = ta.current
    if (!el) return
    const s = el.selectionStart
    const lineStart = body.lastIndexOf('\n', s - 1) + 1
    setBody(body.slice(0, lineStart) + prefix + body.slice(lineStart))
    requestAnimationFrame(() => { el.focus(); el.setSelectionRange(s + prefix.length, s + prefix.length) })
  }
  function link() {
    const url = window.prompt('Link címe (https://…):', 'https://')
    if (!url || !/^(https?:\/\/|mailto:|tel:)/.test(url)) return
    wrap('[', `](${url})`, 'link szövege')
  }

  async function save() {
    setSaving(true)
    setMsg(null)
    const r = await adminFetch('/api/admin/documents', { method: 'PUT', body: { kind, body, effectiveDate: date || null } })
    setSaving(false)
    if (!r.ok) return setMsg({ ok: false, text: reasonText(r.reason) })
    const at = new Intl.DateTimeFormat('hu-HU', { timeZone: 'Europe/Budapest', hour: '2-digit', minute: '2-digit' }).format(new Date())
    setSaved({ body, date, at })
    setMsg({ ok: true, text: `Mentve ${at}-kor, és már élesben is látszik.` })
    if (versions) void loadVersions()
  }

  async function loadVersions() {
    const r = await adminFetch<{ ok: boolean; versions?: DocVersion[] }>(`/api/admin/documents?kind=${kind}`)
    setVersions(r.ok && r.versions ? r.versions : [])
  }

  async function restore(v: DocVersion) {
    if (dirty && !window.confirm('A mentetlen változtatásaid elvesznek. Folytatod?')) return
    if (!window.confirm(`Visszaállítod a ${v.createdAt}-i változatot? Ez lesz élesben; a mostani is megmarad a korábbi változatok között.`)) return
    const r = await adminFetch<{ ok: boolean; reason?: string }>('/api/admin/documents/restore', { method: 'POST', body: { versionId: v.id } })
    if (!r.ok) return setMsg({ ok: false, text: reasonText(r.reason) })
    window.location.reload()
  }

  const tool = 'inline-flex min-h-11 min-w-11 items-center justify-center rounded-md border border-line bg-cream px-3 text-sm font-semibold text-deep hover:bg-paper-2'

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted">{HINT[kind]}</p>

      <div className="card overflow-hidden">
        <div className="flex flex-wrap items-center gap-2 border-b border-line bg-paper p-2">
          <div role="tablist" aria-label="Nézet" className="mr-2 flex rounded-full border border-line bg-cream p-0.5">
            {(['edit', 'preview'] as const).map((t) => (
              <button key={t} type="button" role="tab" aria-selected={tab === t} onClick={() => setTab(t)} className={`min-h-11 rounded-full px-4 text-sm font-semibold ${tab === t ? 'bg-deep text-cream' : 'text-deep'}`}>
                {t === 'edit' ? 'Szerkesztés' : 'Előnézet'}
              </button>
            ))}
          </div>
          {tab === 'edit' && (
            <>
              <button type="button" className={tool} onClick={() => linePrefix('## ')} title="Fejezetcím">Cím</button>
              <button type="button" className={tool} onClick={() => wrap('**', '**')} title="Félkövér"><strong>F</strong></button>
              <button type="button" className={tool} onClick={() => linePrefix('- ')} title="Felsorolás">• Lista</button>
              <button type="button" className={tool} onClick={link} title="Link">Link</button>
            </>
          )}
        </div>
        {tab === 'edit' ? (
          <textarea
            ref={ta}
            aria-label={label}
            value={body}
            onChange={(e) => setBody(e.target.value)}
            rows={22}
            className="block w-full resize-y bg-cream p-4 font-mono text-[0.92rem] leading-relaxed text-ink outline-none focus:ring-2 focus:ring-deep"
          />
        ) : (
          <div data-skin className="doc max-h-[70vh] overflow-y-auto bg-[#FCFCFA] p-5 md:p-8">
            {body.trim() ? <Markdown source={body} /> : <p className="text-muted">Üres: az oldal nem jelenik meg.</p>}
          </div>
        )}
      </div>

      <div className="flex flex-wrap items-end gap-4">
        {withDate && (
          <div className="field">
            <label htmlFor={`eff-${kind}`}>Hatályos ettől</label>
            <input id={`eff-${kind}`} type="date" className="input" value={date} onChange={(e) => setDate(e.target.value)} />
          </div>
        )}
        <button type="button" className="btn btn-primary" onClick={save} disabled={saving || !dirty}>{saving ? 'Mentés…' : dirty ? 'Mentés és közzététel' : 'Nincs mentetlen változás'}</button>
        <Link href={path} target="_blank" className="inline-flex min-h-12 items-center text-sm font-semibold text-deep underline underline-offset-2">Megnézem az oldalon ↗</Link>
      </div>
      {dirty && <p className="text-sm font-semibold text-action" role="status">Mentetlen változtatások.</p>}
      {msg && <p className={msg.ok ? 'font-semibold text-success' : 'err'} role="status">{msg.text}</p>}
      {saved.at && !msg && <p className="text-sm text-muted">Utolsó mentés: {saved.at}</p>}

      <details className="card p-4" onToggle={(e) => { if ((e.target as HTMLDetailsElement).open && !versions) void loadVersions() }}>
        <summary className="min-h-11 cursor-pointer py-2 font-semibold text-deep">Korábbi változatok (az utolsó 20)</summary>
        {versions === null ? <p className="text-sm text-muted">Betöltés…</p> : versions.length === 0 ? <p className="text-sm text-muted">Még nincs korábbi változat.</p> : (
          <ul className="mt-2 divide-y divide-line">
            {versions.map((v, i) => (
              <li key={v.id} className="flex flex-wrap items-center justify-between gap-3 py-3 text-sm">
                <span>
                  <strong>{v.createdAt}</strong>{i === 0 && <span className="ml-2 rounded-full bg-paper-2 px-2 py-0.5 text-xs">élesben</span>}
                  <span className="block text-muted">{v.chars} karakter · {v.preview}…</span>
                </span>
                {i > 0 && <button type="button" className="btn btn-ghost btn-sm" onClick={() => restore(v)}>Visszaállítom</button>}
              </li>
            ))}
          </ul>
        )}
      </details>
    </div>
  )
}
