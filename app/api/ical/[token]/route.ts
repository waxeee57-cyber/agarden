import { exportFor } from '@/lib/ical'

// Public busy-days feed for Airbnb / Booking.com ("naptár importálása").
// The 64-hex token in the URL is the only key; dates only, no guest data.
// CDN-cached 15 min: their pollers never wake the database more than that.
export async function GET(_req: Request, { params }: { params: Promise<{ token: string }> }) {
  const token = (await params).token.replace(/\.ics$/, '')
  const r = await exportFor(token).catch(() => null)
  if (!r) return new Response('Not found', { status: 404, headers: { 'cache-control': 'no-store' } })
  return new Response(r.ics, {
    headers: {
      'content-type': 'text/calendar; charset=utf-8',
      'cache-control': 'public, max-age=0, s-maxage=900, stale-while-revalidate=3600',
      'x-robots-tag': 'noindex',
    },
  })
}
