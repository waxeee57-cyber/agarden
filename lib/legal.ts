// Operator / legal data the owner fills in on the admin "Adatok" tab.
// Pure + client-safe (no DB): shared by the admin form, the admin banner and the
// public legal pages. Empty = not given yet -> shown as "pótlásra vár".

export type LegalData = {
  operatorName?: string
  operatorAddress?: string
  taxNumber?: string
  paymentTerms?: string
  cancellation?: string
  retention?: string
  processorsConfirmed?: boolean
  /** YYYY-MM-DD of the owner's last save (Europe/Budapest), set by the DB. */
  updatedAt?: string
}

/** DB jsonb (snake_case) -> LegalData. Unknown keys are dropped. */
export function legalFromDb(raw: unknown): LegalData {
  const r = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>
  const s = (v: unknown) => (typeof v === 'string' && v.trim() ? v.trim() : undefined)
  return {
    operatorName: s(r.operator_name),
    operatorAddress: s(r.operator_address),
    taxNumber: s(r.tax_number),
    paymentTerms: s(r.payment_terms),
    cancellation: s(r.cancellation),
    retention: s(r.retention),
    processorsConfirmed: r.processors_confirmed === true,
    updatedAt: typeof r.updated_at === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(r.updated_at) ? r.updated_at : undefined,
  }
}

export function legalToDb(d: LegalData): Record<string, string | boolean> {
  const out: Record<string, string | boolean> = {}
  const put = (k: string, v?: string) => { if (v && v.trim()) out[k] = v.trim() }
  put('operator_name', d.operatorName)
  put('operator_address', d.operatorAddress)
  put('tax_number', d.taxNumber)
  put('payment_terms', d.paymentTerms)
  put('cancellation', d.cancellation)
  put('retention', d.retention)
  out.processors_confirmed = d.processorsConfirmed === true
  return out
}

/** Multi-line field -> one point per non-empty line. */
export const lines = (s?: string) => (s ?? '').split('\n').map((l) => l.trim()).filter(Boolean)

/** "Név, cím, adószám" in one line, or null if any part is missing. */
export function operatorLine(d: LegalData): string | null {
  if (!d.operatorName || !d.operatorAddress || !d.taxNumber) return null
  return `${d.operatorName}, ${d.operatorAddress}, adószám: ${d.taxNumber}`
}

export type LegalCheck = { key: string; label: string }

/** What is still missing for the legal pages to be complete (owner-facing labels). */
export function missingLegal(d: LegalData, times: { checkinWindow: string | null; checkoutTime: string | null }): LegalCheck[] {
  const m: LegalCheck[] = []
  if (!d.operatorName) m.push({ key: 'operatorName', label: 'Üzemeltető neve' })
  if (!d.operatorAddress) m.push({ key: 'operatorAddress', label: 'Székhely / lakcím' })
  if (!d.taxNumber) m.push({ key: 'taxNumber', label: 'Adószám' })
  if (!d.paymentTerms) m.push({ key: 'paymentTerms', label: 'Fizetés, kaució, idegenforgalmi adó' })
  if (!d.cancellation) m.push({ key: 'cancellation', label: 'Lemondási feltételek' })
  if (!times.checkinWindow) m.push({ key: 'checkinWindow', label: 'Érkezés időpontja' })
  if (!times.checkoutTime) m.push({ key: 'checkoutTime', label: 'Távozás időpontja' })
  if (!d.retention) m.push({ key: 'retention', label: 'Adatok megőrzési ideje' })
  if (!d.processorsConfirmed) m.push({ key: 'processorsConfirmed', label: 'Adatfeldolgozók jóváhagyása' })
  return m
}

const HU_MONTHS = ['január', 'február', 'március', 'április', 'május', 'június', 'július', 'augusztus', 'szeptember', 'október', 'november', 'december']
/** "2026-10-26" -> "2026. október 26." */
export function huDate(iso: string): string {
  const [y, m, d] = iso.split('-').map(Number)
  return `${y}. ${HU_MONTHS[m - 1]} ${d}.`
}
