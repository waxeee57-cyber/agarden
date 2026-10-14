'use client'

// Tiny fetch wrapper for /api/admin/*. Same-origin JSON; the session cookie
// rides along automatically (httpOnly, never readable here).
export async function adminFetch<T = { ok: boolean; reason?: string }>(path: string, init: { method: string; body?: unknown } = { method: 'GET' }): Promise<T> {
  const res = await fetch(path, {
    method: init.method,
    headers: init.body !== undefined && !(init.body instanceof FormData) ? { 'content-type': 'application/json' } : undefined,
    body: init.body === undefined ? undefined : init.body instanceof FormData ? init.body : JSON.stringify(init.body),
    cache: 'no-store',
  })
  if (res.status === 401) {
    window.location.href = '/admin/login'
    return { ok: false, reason: 'unauthorized' } as T
  }
  return res.json().catch(() => ({ ok: false, reason: 'unknown' })) as Promise<T>
}

export const REASONS: Record<string, string> = {
  overlap: 'Ütközik egy meglévő foglalással vagy blokkal.',
  min_nights: 'Rövidebb a minimális éjszakaszámnál (1 éjhez aktív 1 éjszakás felár kell).',
  invalid_dates: 'A záró dátum legyen későbbi a kezdőnél.',
  missing_dates: 'Ehhez az ajánlatkéréshez nincs dátum, így nem igazolható vissza. Rögzíts kézi foglalást.',
  capacity_unavailable: 'A létszám meghaladja a ház kapacitását.',
  validation_error: 'Ellenőrizd a mezőket.',
  surcharge_amount_required: 'Aktív felárhoz 0-nál nagyobb összeg kell.',
  not_found: 'Nem található (lehet, hogy már törölték).',
  too_large: 'A fájl túl nagy.',
  unsupported_type: 'Csak JPG, PNG, WebP, AVIF vagy HEIC kép tölthető fel.',
  processing_failed: 'A képet nem sikerült feldolgozni.',
  forbidden: 'A kérés elutasítva (más oldalról érkezett).',
}
export const reasonText = (r?: string) => (r && REASONS[r]) || 'Nem sikerült. Próbáld újra.'
