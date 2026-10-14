'use client'

import { useState } from 'react'
import Image from 'next/image'
import { useRouter } from 'next/navigation'
import type { Photo } from '@/lib/listing'
import { adminFetch, reasonText } from './client'

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

export function PhotoManager({ photos }: { photos: Photo[] }) {
  const router = useRouter()
  const [list, setList] = useState(photos)
  const [uploading, setUploading] = useState<string | null>(null)
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null)
  const [alts, setAlts] = useState<Record<string, string>>(Object.fromEntries(photos.map((p) => [p.id, p.alt])))

  async function upload(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? [])
    e.target.value = ''
    setMsg(null)
    for (const [i, file] of files.entries()) {
      setUploading(`${i + 1}/${files.length}: ${file.name}`)
      const fd = new FormData()
      const blob = await downsize(file)
      fd.append('file', blob instanceof File ? blob : new File([blob], file.name.replace(/\.\w+$/, '.jpg'), { type: 'image/jpeg' }))
      fd.append('alt', '')
      const r = await adminFetch('/api/admin/photos', { method: 'POST', body: fd })
      if (!r.ok) { setMsg({ ok: false, text: `${file.name}: ${reasonText(r.reason)}` }); break }
    }
    setUploading(null)
    // full reload: the list state was seeded from server props
    window.location.reload()
  }

  async function patch(id: string, body: { alt?: string; isCover?: true }) {
    const r = await adminFetch(`/api/admin/photos/${id}`, { method: 'PATCH', body })
    if (r.ok) {
      setMsg({ ok: true, text: body.isCover ? 'Borítókép beállítva.' : 'Leírás mentve.' })
      if (body.isCover) setList(list.map((p) => ({ ...p, isCover: p.id === id })))
    } else setMsg({ ok: false, text: reasonText(r.reason) })
  }

  async function move(i: number, d: -1 | 1) {
    const j = i + d
    if (j < 0 || j >= list.length) return
    const next = [...list]
    ;[next[i], next[j]] = [next[j], next[i]]
    setList(next)
    const r = await adminFetch('/api/admin/photos', { method: 'PUT', body: { ids: next.map((p) => p.id) } })
    if (!r.ok) setMsg({ ok: false, text: reasonText(r.reason) })
  }

  async function remove(id: string) {
    if (!window.confirm('Törlöd a fotót?')) return
    const r = await adminFetch(`/api/admin/photos/${id}`, { method: 'DELETE' })
    if (r.ok) { setList(list.filter((p) => p.id !== id)); router.refresh() }
    else setMsg({ ok: false, text: reasonText(r.reason) })
  }

  return (
    <div>
      <label className="btn btn-primary cursor-pointer">
        <input type="file" accept="image/jpeg,image/png,image/webp,image/avif,image/heic" multiple className="sr-only" onChange={upload} disabled={!!uploading} />
        {uploading ? `Feltöltés ${uploading}` : '+ Fotók feltöltése'}
      </label>
      <p className="mt-2 text-sm text-muted">A képeket automatikusan 1200 px-re kicsinyítjük, WebP-be mentjük, és eltávolítjuk a rejtett adatokat (pl. GPS).</p>
      {msg && <p className={`mt-3 ${msg.ok ? 'font-semibold text-success' : 'err'}`} role="status">{msg.text}</p>}

      {list.length === 0 ? (
        <p className="mt-8 rounded-[var(--radius-lg)] border border-dashed border-line p-8 text-center text-muted">Még nincs fotó. A galéria addig nem jelenik meg az oldalon.</p>
      ) : (
        <ul className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {list.map((p, i) => (
            <li key={p.id} className="overflow-hidden rounded-[var(--radius-lg)] border border-line bg-cream">
              <div className="relative aspect-[4/3] bg-paper-2">
                <Image src={p.url} alt={p.alt} fill sizes="(min-width: 1024px) 33vw, (min-width: 640px) 50vw, 100vw" className="object-cover" />
                {p.isCover && <span className="absolute left-2 top-2 rounded-full bg-deep px-2.5 py-1 text-xs font-semibold text-cream">Borítókép</span>}
              </div>
              <div className="space-y-2 p-3">
                <label className="field-label" htmlFor={`alt-${p.id}`}>Leírás (alt szöveg)</label>
                <div className="flex gap-2">
                  <input id={`alt-${p.id}`} className="input" value={alts[p.id] ?? ''} onChange={(e) => setAlts({ ...alts, [p.id]: e.target.value })} />
                  <button type="button" className="btn btn-ghost btn-sm" onClick={() => patch(p.id, { alt: alts[p.id] ?? '' })}>Ment</button>
                </div>
                <div className="flex flex-wrap gap-1">
                  <button type="button" className="btn btn-ghost btn-sm" aria-label="Előrébb" onClick={() => move(i, -1)} disabled={i === 0}>↑</button>
                  <button type="button" className="btn btn-ghost btn-sm" aria-label="Hátrébb" onClick={() => move(i, 1)} disabled={i === list.length - 1}>↓</button>
                  {!p.isCover && <button type="button" className="btn btn-ghost btn-sm" onClick={() => patch(p.id, { isCover: true })}>Borító</button>}
                  <button type="button" className="btn btn-ghost btn-sm !text-danger" onClick={() => remove(p.id)}>Törlés</button>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
