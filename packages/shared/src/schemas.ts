import { z } from "zod";

// ---------- Primitives ----------

export const SlugSchema = z
  .string()
  .min(1)
  .max(60)
  .regex(/^[a-z0-9-]+$/, "Slug must be lowercase letters, numbers, or hyphens");

export const TimezoneSchema = z.string().min(1);

// 0 = Sunday, 6 = Saturday — matches JS Date.getDay()
export const WeekdaySchema = z.number().int().min(0).max(6);

// Minutes from midnight, 0..1440 (1440 = end of day)
export const MinuteOfDaySchema = z.number().int().min(0).max(1440);

// ---------- Event Type ----------

// Note: `slug` is NOT in the request schemas. It's derived server-side from
// the title on create, and is immutable thereafter — so a shared link never
// breaks when the host renames an event.
const EventTypeBaseSchema = z.object({
  title: z.string().min(1).max(120),
  description: z.string().max(2000).optional().nullable(),
  durationMinutes: z.number().int().min(5).max(8 * 60),
  scheduleId: z.string().min(1),
  bufferBefore: z.number().int().min(0).max(120).default(0),
  bufferAfter: z.number().int().min(0).max(120).default(0),
  // Cal.com semantics: hidden=true hides the event from the host's public
  // profile listing, but the direct booking link still works.
  hidden: z.boolean().default(false),
});

export const CreateEventTypeSchema = EventTypeBaseSchema;
export const UpdateEventTypeSchema = EventTypeBaseSchema.partial();

// ---------- Availability ----------

export const AvailabilityRuleInputSchema = z
  .object({
    weekday: WeekdaySchema,
    startMinute: MinuteOfDaySchema,
    endMinute: MinuteOfDaySchema,
  })
  .refine((r) => r.endMinute > r.startMinute, {
    message: "endMinute must be after startMinute",
  });

export const DateOverrideInputSchema = z
  .object({
    // ISO date string YYYY-MM-DD
    date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    startMinute: MinuteOfDaySchema.nullable(),
    endMinute: MinuteOfDaySchema.nullable(),
  })
  .refine(
    (o) =>
      (o.startMinute === null && o.endMinute === null) ||
      (o.startMinute !== null && o.endMinute !== null && o.endMinute > o.startMinute),
    { message: "Both minutes must be set, or both null (full-day block)" },
  );

export const CreateScheduleSchema = z.object({
  name: z.string().min(1).max(80),
  timezone: TimezoneSchema,
  isDefault: z.boolean().default(false),
  rules: z.array(AvailabilityRuleInputSchema).default([]),
  overrides: z.array(DateOverrideInputSchema).default([]),
});

export const UpdateScheduleSchema = CreateScheduleSchema.partial();

// ---------- Booking ----------

export const CreateBookingSchema = z.object({
  eventTypeId: z.string().min(1),
  startTime: z.string().datetime(), // ISO UTC
  attendeeName: z.string().min(1).max(120),
  attendeeEmail: z.string().email(),
  attendeeNotes: z.string().max(2000).optional().nullable(),
  attendeeTimezone: TimezoneSchema,
});

export const RescheduleBookingSchema = z.object({
  startTime: z.string().datetime(),
});

export const CancelBookingSchema = z.object({
  reason: z.string().max(500).optional().nullable(),
});

// ---------- Slots ----------

export const SlotsQuerySchema = z.object({
  eventTypeId: z.string().min(1),
  from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  timezone: TimezoneSchema.optional(),
});
