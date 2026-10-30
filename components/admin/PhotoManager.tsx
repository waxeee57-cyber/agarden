'use client'

import { useState } from 'react'
import Image from 'next/image'
import { useRouter } from 'next/navigation'
import type { Photo } from '@/lib/listing'
import { PHOTO_CATEGORIES, PHOTO_CATEGORY_LABEL, type PhotoCategory } from '@/lib/terms'
import { adminFetch, reasonText } from './client'

// Gallery admin: multi-upload with progress, category per photo, order by drag
// (desktop) or ↑/↓ (phone), cover + 3 featured slots for the homepage, alt
// text, delete with confirmation.
// Upload → (browser downsize to ≤2400 px JPEG, keeps the request under Vercel's
// 4.5 MB body limit) → server sharp (≤1200 px WebP, EXIF stripped) → Blob.
async function downsize(file: File): Promise<Blob> {
  if (file.size < 3_500_000 || !file.type.startsWith('image/') || /heic|heif/.test(file.type)) return file
  const bmp = await createImageBitmap(file)
  const scale = Math.min(1, 2400 / Math.max(bmp.width, bmp.height))
  const canvas = new OffscreenCanvas(Math.round(bmp.width * scale), Math.round(bmp.height * scale))
  canvas.getContext('2d')!.drawImage(bmp, 0, 0, canvas.width, canvas.height)
  return canvas.convertToBlob({ type: 'image/jpeg', quality: 0.9 })
}

/** XHR (not fetch) so the owner sees real upload progress on a slow mobile connection. */
function send(fd: FormData, onProgress: (p: number) => void): Promise<{ ok: boolean; reason?: string }> {
  return new Promise((resolve) => {
    const x = new XMLHttpRequest()
    x.open('POST', '/api/admin/photos')
    x.upload.onprogress = (e) => { if (e.lengthComputable) onProgress(e.loaded / e.total) }
    x.onload = () => {
      if (x.status === 401) { window.location.href = '/admin/login'; return }
      try { resolve(JSON.parse(x.responseText)) } catch { resolve({ ok: false, reason: 'unknown' }) }
    }
    x.onerror = () => resolve({ ok: false, reason: 'network' })
    x.send(fd)
  })
}

type Up = { name: string; progress: number; state: 'waiting' | 'uploading' | 'done' | 'error'; error?: string }

export function PhotoManager({ photos }: { photos: Photo[] }) {
  const router = useRouter()
  const [list, setList] = useState(photos)
  const [ups, setUps] = useState<Up[]>([])
  const [upCat, setUpCat] = useState<PhotoCategory>('egyeb')
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null)
  const [alts, setAlts] = useState<Record<string, string>>(Object.fromEntries(photos.map((p) => [p.id, p.alt])))
  const [drag, setDrag] = useState<number | null>(null)
  const busy = ups.some((u) => u.state === 'uploading' || u.state === 'waiting')

  async function upload(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? [])
    e.target.value = ''
    if (!files.length) return
    setMsg(null)
    const state: Up[] = files.map((f) => ({ name: f.name, progress: 0, state: 'waiting' }))
    setUps([...state])
    for (const [i, file] of files.entries()) {
      state[i] = { ...state[i], state: 'uploading' }
      setUps([...state])
      const fd = new FormData()
      const blob = await downsize(file)
      fd.append('file', blob instanceof File ? blob : new File([blob], file.name.replace(/\.\w+$/, '.jpg'), { type: 'image/jpeg' }))
      fd.append('alt', '')
      fd.append('category', upCat)
      const r = await send(fd, (p) => { state[i] = { ...state[i], progress: p }; setUps([...state]) })
      state[i] = r.ok ? { ...state[i], progress: 1, state: 'done' } : { ...state[i], state: 'error', error: reasonText(r.reason) }
      setUps([...state])
    }
    const failed = state.filter((u) => u.state === 'error').length
    if (failed) {
      // keep the per-file errors on screen; the successful ones show after a reload
      setMsg({ ok: false, text: `${files.length - failed} kép feltöltve, ${failed} nem sikerült (lásd fent). Frissítsd az oldalt az újak megjelenítéséhez.` })
      return
    }
    // pick up the new rows (ids, urls) from the server
    window.location.reload()
  }

  async function patch(id: string, body: { alt?: string; isCover?: true; category?: PhotoCategory; featured?: number | null }, ok: string) {
    const r = await adminFetch(`/api/admin/photos/${id}`, { method: 'PATCH', body })
    if (!r.ok) return setMsg({ ok: false, text: reasonText(r.reason) })
    setMsg({ ok: true, text: ok })
    setList((l) => l.map((p) => {
      if (body.isCover) return { ...p, isCover: p.id === id }
      if (body.featured !== undefined) return p.id === id ? { ...p, featured: body.featured } : p.featured === body.featured && body.featured != null ? { ...p, featured: null } : p
      if (body.category) return p.id === id ? { ...p, category: body.category } : p
      if (body.alt !== undefined) return p.id === id ? { ...p, alt: body.alt } : p
      return p
    }))
  }

  async function reorder(next: Photo[]) {
    setList(next)
    const r = await adminFetch('/api/admin/photos', { method: 'PUT', body: { ids: next.map((p) => p.id) } })
    setMsg(r.ok ? { ok: true, text: 'Sorrend mentve.' } : { ok: false, text: reasonText(r.reason) })
  }
  const move = (i: number, j: number) => {
    if (j < 0 || j >= list.length || i === j) return
    const next = [...list]
    const [x] = next.splice(i, 1)
    next.splice(j, 0, x)
    void reorder(next)
  }

  async function remove(p: Photo) {
    if (!window.confirm(`Biztosan törlöd ezt a fotót?\n„${p.alt || 'leírás nélkül'}”\nA törlés nem vonható vissza.`)) return
    const r = await adminFetch(`/api/admin/photos/${p.id}`, { method: 'DELETE' })
    if (r.ok) { setList(list.filter((x) => x.id !== p.id)); setMsg({ ok: true, text: 'Fotó törölve.' }); router.refresh() }
    else setMsg({ ok: false, text: reasonText(r.reason) })
  }

  const missingAlt = list.filter((p) => !p.alt.trim()).length

  return (
    <div>
      <div className="card flex flex-col gap-4 p-4 md:flex-row md:items-end">
        <div className="field md:w-64">
          <label htmlFor="up-cat">Új képek kategóriája</label>
          <select id="up-cat" className="input" value={upCat} onChange={(e) => setUpCat(e.target.value as PhotoCategory)}>
            {PHOTO_CATEGORIES.map((c) => <option key={c} value={c}>{PHOTO_CATEGORY_LABEL[c]}</option>)}
          </select>
        </div>
        <label className={`btn btn-primary cursor-pointer ${busy ? 'pointer-events-none opacity-60' : ''}`}>
          <input type="file" accept="image/jpeg,image/png,image/webp,image/avif,image/heic" multiple className="sr-only" onChange={upload} disabled={busy} />
          + Fotók feltöltése (több is)
        </label>
      </div>
      <p className="mt-2 text-sm text-muted">A képeket automatikusan 1200 px-re kicsinyítjük, WebP-be mentjük, és eltávolítjuk a rejtett adatokat (pl. GPS).</p>

      {ups.length > 0 && (
        <ul className="mt-4 space-y-2" aria-live="polite">
          {ups.map((u, i) => (
            <li key={i} className="text-sm">
              <div className="flex justify-between gap-3"><span className="truncate">{u.name}</span><span className="shrink-0 text-muted">{u.state === 'done' ? 'kész' : u.state === 'error' ? u.error : u.state === 'waiting' ? 'vár' : `${Math.round(u.progress * 100)}%`}</span></div>
              <div className="mt-1 h-2 overflow-hidden rounded-full bg-paper-2"><div className={`h-full ${u.state === 'error' ? 'bg-danger' : 'bg-deep'}`} style={{ width: `${Math.round((u.state === 'done' ? 1 : u.progress) * 100)}%` }} /></div>
            </li>
          ))}
        </ul>
      )}
      {msg && <p className={`mt-3 ${msg.ok ? 'font-semibold text-success' : 'err'}`} role="status">{msg.text}</p>}
      {missingAlt > 0 && <p className="mt-3 text-sm text-muted">{missingAlt} képnek még nincs leírása. A leírás segít a keresőknek és a gyengénlátó vendégeknek.</p>}

      {list.length === 0 ? (
        <p className="mt-8 rounded-[var(--radius-lg)] border border-dashed border-line p-8 text-center text-muted">Még nincs fotó. A galéria addig nem jelenik meg az oldalon.</p>
      ) : (
        <ul className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {list.map((p, i) => (
            <li
              key={p.id}
              draggable
              onDragStart={() => setDrag(i)}
              onDragOver={(e) => e.preventDefault()}
              onDrop={() => { if (drag !== null) move(drag, i); setDrag(null) }}
              onDragEnd={() => setDrag(null)}
              className={`overflow-hidden rounded-[var(--radius-lg)] border bg-cream ${drag === i ? 'border-deep opacity-60' : 'border-line'}`}
            >
              <div className="relative aspect-[4/3] cursor-grab bg-paper-2 active:cursor-grabbing">
                <Image src={p.url} alt={p.alt} fill sizes="(min-width: 1024px) 33vw, (min-width: 640px) 50vw, 100vw" className="object-cover" />
                <span className="absolute left-2 top-2 flex gap-1">
                  <span className="rounded-full bg-cream/90 px-2.5 py-1 text-xs font-semibold text-deep">{i + 1}.</span>
                  {p.isCover && <span className="rounded-full bg-deep px-2.5 py-1 text-xs font-semibold text-cream">Borítókép</span>}
                  {p.featured && <span className="rounded-full bg-accent px-2.5 py-1 text-xs font-semibold text-ink">Főoldal {p.featured}.</span>}
                </span>
              </div>
              <div className="space-y-3 p-3">
                <div className="field">
                  <label htmlFor={`alt-${p.id}`}>Leírás (mi látszik a képen?)</label>
                  <div className="flex gap-2">
                    <input id={`alt-${p.id}`} className="input" value={alts[p.id] ?? ''} onChange={(e) => setAlts({ ...alts, [p.id]: e.target.value })} />
                    <button type="button" className="btn btn-ghost btn-sm" onClick={() => patch(p.id, { alt: alts[p.id] ?? '' }, 'Leírás mentve.')}>Ment</button>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div className="field">
                    <label htmlFor={`cat-${p.id}`}>Kategória</label>
                    <select id={`cat-${p.id}`} className="input" value={p.category} onChange={(e) => patch(p.id, { category: e.target.value as PhotoCategory }, 'Kategória mentve.')}>
                      {PHOTO_CATEGORIES.map((c) => <option key={c} value={c}>{PHOTO_CATEGORY_LABEL[c]}</option>)}
                    </select>
                  </div>
                  <div className="field">
                    <label htmlFor={`feat-${p.id}`}>Főoldalon</label>
                    <select id={`feat-${p.id}`} className="input" value={p.featured ?? ''} onChange={(e) => patch(p.id, { featured: e.target.value ? Number(e.target.value) : null }, 'Főoldali kép beállítva.')}>
                      <option value="">nem</option>
                      <option value="1">1. (nagy)</option>
                      <option value="2">2.</option>
                      <option value="3">3.</option>
                    </select>
                  </div>
                </div>
                <div className="flex flex-wrap gap-1">
                  <button type="button" className="btn btn-ghost btn-sm" aria-label={`${i + 1}. kép előrébb`} onClick={() => move(i, i - 1)} disabled={i === 0}>↑</button>
                  <button type="button" className="btn btn-ghost btn-sm" aria-label={`${i + 1}. kép hátrébb`} onClick={() => move(i, i + 1)} disabled={i === list.length - 1}>↓</button>
                  {!p.isCover && <button type="button" className="btn btn-ghost btn-sm" onClick={() => patch(p.id, { isCover: true }, 'Borítókép beállítva.')}>Legyen borító</button>}
                  <button type="button" className="btn btn-ghost btn-sm !text-danger" onClick={() => remove(p)}>Törlés</button>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
