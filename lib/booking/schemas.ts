import { z } from 'zod'

// Form-shape validation only. All booking BUSINESS rules (min-nights, overlap,
// surcharge math, capacity) live in the DB RPCs / app layer — never duplicated
// here. ISO date strings compare correctly lexically (YYYY-MM-DD).

const dateStr = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'date must be YYYY-MM-DD')
  .refine((s) => !Number.isNaN(Date.parse(s)), 'invalid calendar date')

// z.guid() = generic 8-4-4-4-12 hex GUID. z.uuid() (zod v4) additionally
// enforces RFC-4122 version/variant bits, which our deterministic seed IDs
// (e.g. 2222…-2222…) intentionally do not carry — Postgres accepts them fine.
const uuid = z.guid()
const email = z.email()
const guestName = z.string().min(2)

export const availabilitySchema = z.object({
  listingId: uuid,
  from: dateStr,
  to: dateStr,
})

export const quoteSchema = z
  .object({
    listingId: uuid,
    checkIn: dateStr,
    checkOut: dateStr,
    guests: z.number().int().min(1),
    pet: z.boolean().default(false),
    isEvent: z.boolean().default(false),
  })
  .refine((d) => d.checkOut > d.checkIn, { message: 'checkOut must be after checkIn', path: ['checkOut'] })

export const createBookingSchema = z
  .object({
    listingId: uuid,
    checkIn: dateStr,
    checkOut: dateStr,
    guests: z.number().int().min(1),
    pet: z.boolean().default(false),
    isEvent: z.boolean().default(false),
    guestName,
    guestEmail: email,
    guestPhone: z.string().min(5).optional(),
  })
  .refine((d) => d.checkOut > d.checkIn, { message: 'checkOut must be after checkIn', path: ['checkOut'] })

export const requestQuoteSchema = z
  .object({
    listingId: uuid,
    // Dates are SOFT for a quote request (a lead may not have firm dates yet).
    checkIn: dateStr.optional(),
    checkOut: dateStr.optional(),
    guests: z.number().int().min(1).optional(),
    pet: z.boolean().default(false),
    isEvent: z.boolean().default(false),
    guestName,
    guestEmail: email,
    guestPhone: z.string().min(5).optional(),
    message: z.string().optional(),
  })
  .refine((d) => !(d.checkIn && d.checkOut) || d.checkOut > d.checkIn, {
    message: 'checkOut must be after checkIn',
    path: ['checkOut'],
  })

export type AvailabilityInput = z.input<typeof availabilitySchema>
export type QuoteInput = z.input<typeof quoteSchema>
export type CreateBookingInput = z.input<typeof createBookingSchema>
export type RequestQuoteInput = z.input<typeof requestQuoteSchema>
