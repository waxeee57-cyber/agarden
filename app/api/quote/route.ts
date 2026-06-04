import { NextRequest, NextResponse } from 'next/server'
import { getQuote } from '@/lib/booking'
import { guard } from '@/lib/booking/http'

export async function POST(req: NextRequest) {
  const g = await guard(req, 'quote', 60)
  if (!g.ok) return g.res
  const quote = await getQuote(g.body as Parameters<typeof getQuote>[0])
  // A quote is a valid response even when it reports business invalidity
  // (e.g. min_nights). Only a bad-shape input is a 400.
  const status = quote.reason === 'validation_error' ? 400 : 200
  return NextResponse.json(quote, { status })
}
