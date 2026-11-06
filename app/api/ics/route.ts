import { NextRequest } from 'next/server'
import { siteFromRequest } from '@/lib/site'
import { getListing } from '@/lib/listing'
import { BRANDS } from '@/lib/brand'

// "Naptárba mentés": an all-day calendar entry (RFC 5545) for a stay.
// Stateless — built only from what the guest already has (dates, code) plus
// the house's PUBLIC name/address/phone resolved from the host. Served as
// text/calendar so iOS/Android open their native "add to calendar" sheet.

const ISO = /^\d{4}-\d{2}-\d{2}$/
const CODE = /^[0-9A-Fa-f]{8}$/

const esc = (s: string) => s.replace(/[\\,;]/g, (m) => `\\${m}`).replace(/\r?\n/g, '\\n')
// RFC 5545 §3.1: fold content lines longer than 75 octets
function fold(line: string): string {
  const bytes = new TextEncoder().encode(line)
  if (bytes.length <= 75) return line
  const out: string[] = []
  let cur = ''
  let len = 0
  for (const ch of line) {
    const n = new TextEncoder().encode(ch).length
    if (len + n > (out.length ? 74 : 75)) { out.push(cur); cur = ''; len = 0 }
    cur += ch
    len += n
  }
  out.push(cur)
  return out.join('\r\n ')
}

export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams
  const checkIn = sp.get('checkIn') ?? ''
  const checkOut = sp.get('checkOut') ?? ''
  const code = (sp.get('kod') ?? '').toUpperCase()
  if (!ISO.test(checkIn) || !ISO.test(checkOut) || checkOut <= checkIn || (code && !CODE.test(code))) {
    return new Response('Hibás paraméterek', { status: 400 })
  }
  const site = siteFromRequest(req)
  const listing = await getListing(site).catch(() => null)
  const name = listing?.siteName ?? BRANDS[site].fullName
  const phone = listing?.contactPhone ?? BRANDS[site].phone
  const d = (s: string) => s.replace(/-/g, '')
  const stamp = new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '')
  const desc = [
    code ? `Foglalási kód: ${code}` : null,
    'Visszaigazolt foglalás. Állapot és előleg: Foglalásom oldal, a foglalási kóddal.',
    listing?.checkinWindow ? `Érkezés: ${listing.checkinWindow}` : null,
    listing?.checkoutTime ? `Távozás: ${listing.checkoutTime}` : null,
    `Telefon: ${phone}`,
  ].filter(Boolean).join('\n')
  const lines = [
    'BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//agarden//foglalas//HU', 'CALSCALE:GREGORIAN', 'METHOD:PUBLISH',
    'BEGIN:VEVENT',
    `UID:${code || d(checkIn)}-${d(checkOut)}-${site}@agarden`,
    `DTSTAMP:${stamp}`,
    `DTSTART;VALUE=DATE:${d(checkIn)}`,
    `DTEND;VALUE=DATE:${d(checkOut)}`,
    `SUMMARY:${esc(`${name}${code ? ` (${code})` : ''}`)}`,
    ...(listing?.address ? [`LOCATION:${esc(listing.address)}`] : []),
    `DESCRIPTION:${esc(desc)}`,
    'TRANSP:TRANSPARENT',
    'END:VEVENT', 'END:VCALENDAR',
  ].map(fold)
  return new Response(lines.join('\r\n') + '\r\n', {
    headers: {
      'content-type': 'text/calendar; charset=utf-8',
      'content-disposition': `attachment; filename="foglalas-${checkIn}.ics"`,
      'cache-control': 'no-store',
      'x-robots-tag': 'noindex',
    },
  })
}
