// HUF formatting, Hungarian locale, no decimals (e.g. "75 000 Ft").
const huf = new Intl.NumberFormat('hu-HU', {
  style: 'currency',
  currency: 'HUF',
  maximumFractionDigits: 0,
})

export function formatHuf(value: number | null | undefined): string {
  if (value == null) return '—'
  return huf.format(value)
}
