// Booking terms, menu settings, document kinds, photo categories — pure and
// client-safe. Unknown = null and is not rendered (never a guessed default).

export type Terms = {
  confirmHours: number | null
  depositPct: number | null
  cancelDays: number | null
  quoteValidDays: number | null
  extraCosts: string[]
}

export type SiteSettings = { menuGyik: boolean; menuKornyek: boolean }

const int = (v: unknown, min: number, max: number) => (typeof v === 'number' && Number.isInteger(v) && v >= min && v <= max ? v : null)

export function termsFromDb(raw: unknown): Terms {
  const r = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>
  return {
    confirmHours: int(r.confirm_hours, 1, 168),
    depositPct: int(r.deposit_pct, 1, 100),
    cancelDays: int(r.cancel_days, 0, 365),
    quoteValidDays: int(r.quote_valid_days, 1, 60),
    extraCosts: Array.isArray(r.extra_costs) ? r.extra_costs.filter((x): x is string => typeof x === 'string' && x.trim() !== '') : [],
  }
}

export function termsToDb(t: Terms) {
  return {
    ...(t.confirmHours != null ? { confirm_hours: t.confirmHours } : {}),
    ...(t.depositPct != null ? { deposit_pct: t.depositPct } : {}),
    ...(t.cancelDays != null ? { cancel_days: t.cancelDays } : {}),
    ...(t.quoteValidDays != null ? { quote_valid_days: t.quoteValidDays } : {}),
    extra_costs: t.extraCosts,
  }
}

/** Menu items default to visible; the owner can hide GYIK / Környék. */
export function settingsFromDb(raw: unknown): SiteSettings {
  const r = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>
  return { menuGyik: r.menu_gyik !== false, menuKornyek: r.menu_kornyek !== false }
}

/** One sentence for the booking flow / FAQ; null when no deposit is set. */
export function depositLine(t: Terms): string | null {
  if (t.depositPct == null) return null
  const cancel = t.cancelDays != null ? `, ${t.cancelDays} napon túli lemondásnál visszajár` : ''
  return `A foglalás a szállásdíj ${t.depositPct}%-ának átutalásával válik véglegessé${cancel}.`
}

export const DOC_KINDS = ['hazirend', 'aszf', 'gyik', 'kornyek', 'adatvedelem'] as const
export type DocKind = (typeof DOC_KINDS)[number]
export const DOC_LABEL: Record<DocKind, string> = {
  hazirend: 'Házirend',
  aszf: 'ÁSZF',
  gyik: 'GYIK',
  kornyek: 'Környék & programok',
  adatvedelem: 'Adatkezelési tájékoztató',
}

export const PHOTO_CATEGORIES = ['wellness', 'kert', 'nappali', 'haloszoba', 'furdo', 'kornyek', 'egyeb'] as const
export type PhotoCategory = (typeof PHOTO_CATEGORIES)[number]
export const PHOTO_CATEGORY_LABEL: Record<PhotoCategory, string> = {
  wellness: 'Wellness',
  kert: 'Kert és udvar',
  nappali: 'Nappali és konyha',
  haloszoba: 'Hálószobák',
  furdo: 'Fürdőszobák',
  kornyek: 'Környék',
  egyeb: 'Egyéb',
}
