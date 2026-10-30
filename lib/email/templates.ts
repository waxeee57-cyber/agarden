import 'server-only'
import type { Site } from '../site-map'
import type { Terms } from '../terms'

// Hungarian transactional e-mails, branded per house. Adapted from the
// costasol templates (table layout, inline styles for mail clients).
// EVERY interpolated guest value goes through esc() — guest input is untrusted.

const BRANDS: Record<Site, { name: string; deep: string; accent: string; paper: string }> = {
  velence: { name: 'Garden Vendégház Velence', deep: '#556126', accent: '#E9D9A0', paper: '#F5F6F2' },
  napsugar: { name: 'Napsugár Vendégház Velence', deep: '#0E6070', accent: '#F2A23C', paper: '#F5F6F2' },
}

export function esc(s: unknown): string {
  return String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!)
}

const MONTHS = ['január', 'február', 'március', 'április', 'május', 'június', 'július', 'augusztus', 'szeptember', 'október', 'november', 'december']
export function huDate(iso: string | null | undefined): string {
  if (!iso) return '—'
  const [y, m, d] = iso.split('-').map(Number)
  return `${y}. ${MONTHS[m - 1]} ${d}.`
}

const huf = new Intl.NumberFormat('hu-HU', { style: 'currency', currency: 'HUF', maximumFractionDigits: 0 })

export type MailBooking = {
  kind: 'booking' | 'quote'
  id: string
  guestName: string
  guestEmail: string
  guestPhone?: string | null
  checkIn?: string | null
  checkOut?: string | null
  nights?: number | null
  guests?: number | null
  pet?: boolean
  isEvent?: boolean
  total?: number | null
  message?: string | null
}

export type MailHouse = { site: Site; phone: string | null; email: string | null; origin: string; terms?: Terms }

/** Booking-request wording: deposit houses say so up front; no money is taken online either way. */
function paymentIntro(t: Terms | undefined): string {
  const when = t?.confirmHours ? `${t.confirmHours} órán belül` : 'hamarosan'
  if (t?.depositPct) {
    return `A dátumokat addig fenntartjuk, amíg ${when} visszaigazoljuk. <strong>Most nem vonunk le pénzt.</strong> A visszaigazolás után a foglalás a szállásdíj ${t.depositPct}%-ának átutalásával válik véglegessé; a számlaszámot a visszaigazoló levélben küldjük.`
  }
  return `A dátumokat addig fenntartjuk, amíg ${when} visszaigazoljuk. <strong>Most nem vonunk le pénzt</strong>: a visszaigazolás e-mailben érkezik, a fizetés a helyszínen történik.`
}

function layout(site: Site, house: MailHouse, body: string): string {
  const b = BRANDS[site]
  const contact = [house.phone && esc(house.phone), house.email && `<a href="mailto:${esc(house.email)}" style="color:${b.deep}">${esc(house.email)}</a>`]
    .filter(Boolean)
    .join(' · ')
  return `<!DOCTYPE html><html lang="hu"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:${b.paper};font-family:Arial,Helvetica,sans-serif;color:#18241F;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:${b.paper};"><tr><td align="center" style="padding:28px 14px;">
<table width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;border-radius:14px;overflow:hidden;border:1px solid #D7DCD3;">
<tr><td style="background:${b.deep};padding:24px 32px;border-bottom:3px solid ${b.accent};">
<p style="margin:0;font-size:11px;letter-spacing:3px;text-transform:uppercase;color:${b.accent};font-weight:700;">${esc(b.name)}</p>
<p style="margin:4px 0 0;font-size:12px;color:#FCFCFA;opacity:.8;">Velencei-tó</p></td></tr>
<tr><td style="background:#FCFCFA;padding:30px 32px 24px;">${body}</td></tr>
<tr><td style="background:#EBEEE7;padding:16px 32px;text-align:center;font-size:12px;color:#5F6F64;">${contact || esc(b.name)}<br><a href="${esc(house.origin)}" style="color:${b.deep}">${esc(house.origin.replace(/^https?:\/\//, ''))}</a></td></tr>
</table></td></tr></table></body></html>`
}

function rows(pairs: [string, string | null | undefined][]): string {
  return `<table cellpadding="0" cellspacing="0" width="100%" style="margin:14px 0;">${pairs
    .filter(([, v]) => v != null && v !== '')
    .map(([k, v]) => `<tr><td style="padding:5px 0;font-size:13px;color:#5F6F64;width:140px;vertical-align:top;">${esc(k)}</td><td style="padding:5px 0;font-size:13px;font-weight:600;vertical-align:top;">${v}</td></tr>`)
    .join('')}</table>`
}

function details(b: MailBooking): string {
  return rows([
    ['Érkezés', b.checkIn ? esc(huDate(b.checkIn)) : null],
    ['Távozás', b.checkOut ? esc(huDate(b.checkOut)) : null],
    ['Éjszakák', b.nights ? esc(b.nights) : null],
    ['Létszám', b.guests ? `${esc(b.guests)} fő` : null],
    ['Kisállat', b.pet ? 'igen' : null],
    ['Rendezvény / búcsú', b.isEvent ? 'igen' : null],
    ['Tájékoztató végösszeg', b.total != null ? esc(huf.format(b.total)) : null],
    ['Azonosító', esc(b.id.slice(0, 8))],
  ])
}

export function guestEmail(house: MailHouse, b: MailBooking): { subject: string; html: string } {
  const first = esc(b.guestName.trim().split(/\s+/)[0] || b.guestName)
  const name = BRANDS[house.site].name
  const t = house.terms
  const intro =
    b.kind === 'booking'
      ? `Megkaptuk a foglalási kérelmedet. ${paymentIntro(t)}`
      : `Megkaptuk az ajánlatkérésedet. ${t?.confirmHours ? `${t.confirmHours} órán belül` : 'Hamarosan'} jelentkezünk a részletekkel. Az ajánlatkérés még nem foglal le dátumot.${t?.quoteValidDays ? ` Az ajánlatunk ${t.quoteValidDays} napig érvényes.` : ''}`
  const body = `<h1 style="margin:0 0 12px;font-size:21px;">Szia ${first}!</h1>
<p style="margin:0;font-size:15px;line-height:1.6;">${intro}</p>${details(b)}
<p style="margin:16px 0 0;font-size:14px;line-height:1.6;color:#5F6F64;">Kérdésed van? Válaszolj erre a levélre${house.phone ? `, vagy hívj: ${esc(house.phone)}` : ''}.</p>`
  return {
    subject: b.kind === 'booking' ? `Foglalási kérelem rögzítve – ${name}` : `Ajánlatkérés megérkezett – ${name}`,
    html: layout(house.site, house, body),
  }
}

export function ownerEmail(house: MailHouse, b: MailBooking): { subject: string; html: string } {
  const name = BRANDS[house.site].name
  const body = `<p style="margin:0 0 4px;font-size:16px;font-weight:700;">${b.kind === 'booking' ? 'Új foglalási kérelem' : 'Új ajánlatkérés'}</p>
<p style="margin:0;font-size:13px;color:#5F6F64;">${esc(name)}</p>
${rows([
  ['Név', esc(b.guestName)],
  ['E-mail', `<a href="mailto:${esc(b.guestEmail)}">${esc(b.guestEmail)}</a>`],
  ['Telefon', b.guestPhone ? `<a href="tel:${esc(b.guestPhone)}">${esc(b.guestPhone)}</a>` : null],
])}${details(b)}
${b.message ? `<p style="margin:8px 0 0;font-size:14px;line-height:1.6;font-style:italic;">„${esc(b.message)}”</p>` : ''}
<p style="margin:22px 0 0;"><a href="${esc(house.origin)}/admin" style="display:inline-block;background:${BRANDS[house.site].deep};color:#FBF5EA;padding:12px 22px;border-radius:999px;text-decoration:none;font-weight:700;font-size:14px;">Megnyitás az adminban</a></p>`
  return {
    subject: `${b.kind === 'booking' ? 'Új foglalás' : 'Új ajánlatkérés'}: ${b.guestName} – ${name}`,
    html: layout(house.site, house, body),
  }
}

export type StatusExtras = {
  checkinWindow: string | null; checkoutTime: string | null; address: string | null; sister: { name: string; origin: string }
  /** PRIVATE: only ever rendered into this confirmation e-mail, never on a page. */
  bankAccount?: string | null
}

/** Deposit block of the confirmation: amount (if the price is known), account, reference, cancellation. */
function depositBlock(b: MailBooking, t: Terms | undefined, bank: string | null | undefined): string {
  if (!t?.depositPct) return `<p style="margin:0;font-size:15px;line-height:1.6;">A fizetés a helyszínen történik.</p>`
  const amount = b.total != null ? esc(huf.format(Math.round((b.total * t.depositPct) / 100))) : `a visszaigazolt szállásdíj ${t.depositPct}%-a`
  const cancel = t.cancelDays != null ? `${t.cancelDays} napon túli lemondás esetén az előleg visszajár.` : ''
  return `<p style="margin:0;font-size:15px;line-height:1.6;">A foglalás az előleg átutalásával válik véglegessé. ${esc(cancel)}</p>
${rows([
  ['Előleg', amount],
  ['Számlaszám', bank ? esc(bank) : 'telefonon vagy válaszlevélben egyeztetjük'],
  ['Közlemény', esc(b.id.slice(0, 8))],
])}
<p style="margin:0;font-size:14px;line-height:1.6;">A fennmaradó összeget, az idegenforgalmi adót és a kauciót érkezéskor, készpénzben vagy átutalással kérjük.</p>
${t.extraCosts.length ? `<p style="margin:10px 0 0;font-size:13px;line-height:1.6;color:#5F6F64;">${t.extraCosts.map(esc).join('<br>')}</p>` : ''}`
}

/** Sent automatically when the owner confirms or cancels in /admin. */
export function guestStatusEmail(house: MailHouse, b: MailBooking, status: 'confirmed' | 'cancelled', x: StatusExtras): { subject: string; html: string } {
  const first = esc(b.guestName.trim().split(/\s+/)[0] || b.guestName)
  const name = BRANDS[house.site].name
  const accent = BRANDS[house.site].deep
  const call = house.phone ? `, vagy hívj: ${esc(house.phone)}` : ''
  if (status === 'confirmed') {
    const body = `<h1 style="margin:0 0 12px;font-size:21px;">Szia ${first}, visszaigazoltuk!</h1>
<p style="margin:0 0 12px;font-size:15px;line-height:1.6;">A foglalásod rendben van, várunk titeket.</p>${depositBlock(b, house.terms, x.bankAccount)}${details(b)}
${rows([
  ['Bejelentkezés', x.checkinWindow ? esc(x.checkinWindow) : null],
  ['Kijelentkezés', x.checkoutTime ? `${esc(x.checkoutTime)}-ig` : null],
  ['Cím', x.address ? esc(x.address) : null],
])}
<p style="margin:16px 0 0;font-size:14px;line-height:1.6;color:#5F6F64;">Ha bármi változik, válaszolj erre a levélre${call}.</p>`
    return { subject: `Foglalás visszaigazolva – ${name}`, html: layout(house.site, house, body) }
  }
  const body = `<h1 style="margin:0 0 12px;font-size:21px;">Szia ${first}!</h1>
<p style="margin:0;font-size:15px;line-height:1.6;">Sajnos ezt a foglalást nem tudjuk teljesíteni, ezért lemondtuk. Pénzt nem vontunk le.</p>${details(b)}
<p style="margin:16px 0 0;font-size:15px;line-height:1.6;">Másik időpontot keresel? Írj vagy hívj, segítünk${call ? call.replace(', vagy hívj', '. Telefon') : ''}.</p>
<p style="margin:20px 0 0;font-size:14px;line-height:1.6;">A testvérházunkban is lehet szabad hely: <a href="${esc(x.sister.origin)}" style="color:${accent};font-weight:700;">${esc(x.sister.name)}</a></p>`
  return { subject: `Foglalás lemondva – ${name}`, html: layout(house.site, house, body) }
}

/** Kapcsolat form message to the owner (reply goes straight to the sender). */
export function contactEmail(house: MailHouse, m: { name: string; email: string; phone?: string; message: string }): { subject: string; html: string } {
  const name = BRANDS[house.site].name
  const body = `<p style="margin:0 0 4px;font-size:16px;font-weight:700;">Új üzenet a Kapcsolat oldalról</p>
${rows([
  ['Név', esc(m.name)],
  ['E-mail', `<a href="mailto:${esc(m.email)}">${esc(m.email)}</a>`],
  ['Telefon', m.phone ? `<a href="tel:${esc(m.phone)}">${esc(m.phone)}</a>` : null],
])}
<p style="margin:8px 0 0;font-size:15px;line-height:1.6;white-space:pre-line;">${esc(m.message)}</p>
<p style="margin:18px 0 0;font-size:13px;color:#5F6F64;">Válaszolj erre a levélre: a válasz közvetlenül a feladónak megy.</p>`
  return { subject: `Üzenet: ${m.name} – ${name}`, html: layout(house.site, house, body) }
}
