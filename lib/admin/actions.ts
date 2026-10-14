import 'server-only'
import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { query, queryOne, tx } from '../db'
import type { AdminSession } from './auth'

// Admin mutations. The session (already verified for the request host) is the
// ONLY source of listingId. Inputs are validated with zod; DB functions keep
// occupancy and booking status in sync inside one transaction.

type Result = { ok: true; [k: string]: unknown } | { ok: false; reason: string }
const dateStr = z.string().regex(/^\d{4}-\d{2}-\d{2}$/)

function refresh(s: AdminSession) {
  revalidatePath(`/${s.site}`)
}

export async function setBookingStatus(s: AdminSession, bookingId: string, status: unknown): Promise<Result> {
  const p = z.object({ id: z.guid(), status: z.enum(['confirmed', 'cancelled']) }).safeParse({ id: bookingId, status })
  if (!p.success) return { ok: false, reason: 'validation_error' }
  const row = await queryOne<{ r: Result }>('select admin_set_booking_status($1, $2, $3) as r', [p.data.id, s.listingId, p.data.status])
  return row?.r ?? { ok: false, reason: 'unknown' }
}

export async function deleteBooking(s: AdminSession, bookingId: string): Promise<Result> {
  if (!z.guid().safeParse(bookingId).success) return { ok: false, reason: 'validation_error' }
  // occupancy rows cascade (occupancy.booking_id on delete cascade)
  const rows = await query('delete from bookings where id = $1 and listing_id = $2 returning id', [bookingId, s.listingId])
  return rows.length ? { ok: true } : { ok: false, reason: 'not_found' }
}

const blockSchema = z
  .object({ from: dateStr, to: dateStr, kind: z.enum(['manual', 'external']).default('manual'), note: z.string().trim().max(300).optional() })
  .refine((d) => d.to > d.from, { path: ['to'] })

export async function createBlock(s: AdminSession, body: unknown): Promise<Result> {
  const p = blockSchema.safeParse(body)
  if (!p.success) return { ok: false, reason: 'validation_error' }
  const row = await queryOne<{ r: Result }>('select admin_block($1, $2, $3, $4, $5) as r', [s.listingId, p.data.from, p.data.to, p.data.kind, p.data.note ?? null])
  return row?.r ?? { ok: false, reason: 'unknown' }
}

export async function deleteBlock(s: AdminSession, occupancyId: string): Promise<Result> {
  if (!z.guid().safeParse(occupancyId).success) return { ok: false, reason: 'validation_error' }
  // Booking-held dates are released via cancel, not by deleting the block.
  const rows = await query(
    "delete from occupancy where id = $1 and listing_id = $2 and kind in ('manual', 'external') returning id",
    [occupancyId, s.listingId]
  )
  return rows.length ? { ok: true } : { ok: false, reason: 'not_found' }
}

const pricingSchema = z.object({
  nightlyRate: z.number().int().min(1000).max(5_000_000).nullable(),
  surcharges: z
    .array(
      z.object({
        code: z.enum(['single_night', 'pet', 'event']),
        label: z.string().trim().min(2).max(80),
        amount: z.number().int().min(0).max(5_000_000),
        calc: z.enum(['per_stay', 'per_night', 'flat']),
        active: z.boolean(),
      })
    )
    .max(3),
})

/** A nightly rate switches the listing to 'fixed'; clearing it returns to quote-only. */
export async function updatePricing(s: AdminSession, body: unknown): Promise<Result> {
  const p = pricingSchema.safeParse(body)
  if (!p.success) return { ok: false, reason: 'validation_error' }
  if (p.data.surcharges.some((x) => x.active && x.amount <= 0)) return { ok: false, reason: 'surcharge_amount_required' }
  await tx(async (c) => {
    await c.query('update listings set nightly_rate_huf = $2, pricing_mode = $3 where id = $1', [
      s.listingId, p.data.nightlyRate, p.data.nightlyRate == null ? 'quote' : 'fixed',
    ])
    for (const x of p.data.surcharges) {
      await c.query(
        `insert into listing_surcharges (listing_id, code, label, amount_huf, calc, active) values ($1, $2, $3, $4, $5, $6)
         on conflict (listing_id, code) do update set label = excluded.label, amount_huf = excluded.amount_huf, calc = excluded.calc, active = excluded.active`,
        [s.listingId, x.code, x.label, x.amount, x.calc, x.active]
      )
    }
  })
  refresh(s)
  return { ok: true }
}

const contentSchema = z.object({
  tagline: z.string().trim().min(5).max(140),
  lead: z.string().trim().min(10).max(400),
  introBody: z.string().trim().min(10).max(1500),
  houseRules: z.array(z.object({ t: z.string().trim().min(2).max(80), d: z.string().trim().max(300) })).max(20),
  contactEmail: z.union([z.email().max(200), z.literal('')]),
  contactPhone: z.string().trim().min(5).max(40),
})

export async function updateContent(s: AdminSession, body: unknown): Promise<Result> {
  const p = contentSchema.safeParse(body)
  if (!p.success) return { ok: false, reason: 'validation_error' }
  const d = p.data
  await query(
    `update listings set tagline = $2, contact_email = $3, contact_phone = $4, house_rules = $5::jsonb,
            content = content || jsonb_build_object('lead', $6::text, 'intro_body', $7::text)
      where id = $1`,
    [s.listingId, d.tagline, d.contactEmail || null, d.contactPhone, JSON.stringify(d.houseRules), d.lead, d.introBody]
  )
  refresh(s)
  return { ok: true }
}

export async function createManualBooking(s: AdminSession, body: unknown) {
  const { createBooking } = await import('../booking')
  const r = await createBooking(s.listingId, body as Parameters<typeof createBooking>[1], { status: 'confirmed', source: 'manual' })
  return r
}

export { refresh as revalidateSite }
