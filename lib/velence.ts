import { supabase } from './supabase'

// Live Velence listing data that drives the booking widget (capacity, min-nights,
// surcharge labels, demo flag). Falls back to seed-matching constants so the page
// always renders even if the DB is unreachable at request time. Real Velence
// facts only — never invented.

export const VELENCE_SLUG = 'velence'
const VELENCE_FALLBACK_ID = '22222222-2222-2222-2222-222222222222'

export type SurchargeInfo = { code: string; label: string; amount: number; calc: string }

export type VelenceListing = {
  listingId: string
  name: string
  capacityMax: number
  capacityExtra: number
  minNights: number
  nightlyRate: number | null
  pricingMode: string
  currency: string
  surcharges: SurchargeInfo[]
}

const FALLBACK: VelenceListing = {
  listingId: VELENCE_FALLBACK_ID,
  name: 'Garden Vendégház Velence',
  capacityMax: 10,
  capacityExtra: 2,
  minNights: 2,
  nightlyRate: 75000, // DEMO placeholder — matches seed; not a real public price.
  pricingMode: 'demo',
  currency: 'HUF',
  surcharges: [
    { code: 'single_night', label: '1 éjszakás felár', amount: 15000, calc: 'per_stay' },
    { code: 'pet', label: 'Kisállat (kistestű)', amount: 8000, calc: 'per_stay' },
    { code: 'event', label: 'Rendezvény/búcsú', amount: 50000, calc: 'per_stay' },
  ],
}

export async function getVelenceListing(): Promise<VelenceListing> {
  try {
    const { data: listing, error } = await supabase
      .from('listings')
      .select('id, name, capacity_max, capacity_extra, min_nights, nightly_rate_huf, pricing_mode')
      .eq('slug', VELENCE_SLUG)
      .eq('status', 'active')
      .maybeSingle()
    if (error || !listing) return FALLBACK

    const { data: rows } = await supabase
      .from('listing_surcharges')
      .select('code, label, amount_huf, calc, active')
      .eq('listing_id', listing.id)
      .eq('active', true)

    const surcharges: SurchargeInfo[] = (rows ?? []).map((s) => ({
      code: s.code,
      label: s.label,
      amount: s.amount_huf,
      calc: s.calc,
    }))

    return {
      listingId: listing.id,
      name: listing.name,
      capacityMax: listing.capacity_max ?? FALLBACK.capacityMax,
      capacityExtra: listing.capacity_extra ?? 0,
      minNights: listing.min_nights ?? FALLBACK.minNights,
      nightlyRate: listing.nightly_rate_huf,
      pricingMode: listing.pricing_mode ?? 'demo',
      currency: 'HUF',
      surcharges: surcharges.length ? surcharges : FALLBACK.surcharges,
    }
  } catch {
    return FALLBACK
  }
}
