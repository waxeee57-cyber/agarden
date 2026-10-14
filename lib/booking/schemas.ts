import { z } from 'zod'

// Form-shape validation only. Business rules (min-nights, overlap, surcharge
// math) live in the DB functions; capacity is checked in lib/booking.
// The listing is NEVER part of client input: routes resolve it from the host.

const dateStr = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'date must be YYYY-MM-DD')
  .refine((s) => !Number.isNaN(Date.parse(s)), 'invalid calendar date')

const email = z.email().max(200)
const guestName = z.string().trim().min(2).max(120)
const phone = z.string().trim().min(5).max(40)

export const availabilitySchema = z.object({ from: dateStr, to: dateStr })

export const quoteSchema = z
  .object({
    checkIn: dateStr,
    checkOut: dateStr,
    guests: z.number().int().min(1).max(50),
    pet: z.boolean().default(false),
    isEvent: z.boolean().default(false),
  })
  .refine((d) => d.checkOut > d.checkIn, { message: 'checkOut must be after checkIn', path: ['checkOut'] })

export const createBookingSchema = z
  .object({
    checkIn: dateStr,
    checkOut: dateStr,
    guests: z.number().int().min(1).max(50),
    pet: z.boolean().default(false),
    isEvent: z.boolean().default(false),
    guestName,
    guestEmail: email,
    guestPhone: phone.optional(),
    message: z.string().trim().max(2000).optional(),
  })
  .refine((d) => d.checkOut > d.checkIn, { message: 'checkOut must be after checkIn', path: ['checkOut'] })

export const requestQuoteSchema = z
  .object({
    checkIn: dateStr.optional(),
    checkOut: dateStr.optional(),
    guests: z.number().int().min(1).max(50).optional(),
    pet: z.boolean().default(false),
    isEvent: z.boolean().default(false),
    guestName,
    guestEmail: email,
    guestPhone: phone.optional(),
    message: z.string().trim().max(2000).optional(),
  })
  .refine((d) => !(d.checkIn && d.checkOut) || d.checkOut > d.checkIn, {
    message: 'checkOut must be after checkIn',
    path: ['checkOut'],
  })

export type AvailabilityInput = z.input<typeof availabilitySchema>
export type QuoteInput = z.input<typeof quoteSchema>
export type CreateBookingInput = z.input<typeof createBookingSchema>
export type RequestQuoteInput = z.input<typeof requestQuoteSchema>
