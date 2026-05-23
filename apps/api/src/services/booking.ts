import { Prisma } from "@prisma/client";
import { prisma } from "../db";
import { BadRequest, Conflict, NotFound } from "../lib/errors";
import { getAvailableSlots } from "./availability";
import { isoDateInTz } from "../lib/time";
import {
  fireAndForget,
  notifyBookingCancelled,
  notifyBookingCreated,
  notifyBookingRescheduled,
} from "./notifications";
import type { CreateBookingInput } from "@cal/shared";

function dedupedGuests(guests: string[] | undefined, attendee: string): string[] {
  if (!guests || guests.length === 0) return [];
  const lowerAttendee = attendee.toLowerCase();
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of guests) {
    const v = raw.trim();
    const key = v.toLowerCase();
    if (!v || key === lowerAttendee || seen.has(key)) continue;
    seen.add(key);
    out.push(v);
  }
  return out;
}

/**
 * Create a booking with conflict prevention.
 *
 * We rely on a SERIALIZABLE transaction (Prisma's strictest) to make the
 * "is this slot still free?" check atomic with the insert. If two requests
 * race for the same slot, one will succeed and the other will throw a
 * serialization failure, which we surface as a 409.
 */
export async function createBooking(input: CreateBookingInput) {
  const eventType = await prisma.eventType.findUnique({
    where: { id: input.eventTypeId },
    include: { schedule: true },
  });
  // Per cal.com semantics, a `hidden` event can still be booked via its
  // direct link — `hidden` only affects whether it's listed publicly.
  if (!eventType) throw NotFound("Event type not found");

  const requestedStart = new Date(input.startTime);
  if (Number.isNaN(requestedStart.getTime())) throw BadRequest("Invalid startTime");
  if (requestedStart.getTime() <= Date.now()) throw BadRequest("Cannot book a time in the past");

  const requestedEnd = new Date(
    requestedStart.getTime() + eventType.durationMinutes * 60_000,
  );

  // Cheap pre-check: is the requested slot in the current available set?
  // (This bounds the window to one day so the check stays fast.)
  const dateIso = isoDateInTz(requestedStart, input.attendeeTimezone);
  const { slotsByDate } = await getAvailableSlots({
    eventTypeId: eventType.id,
    fromIso: dateIso,
    toIso: dateIso,
    viewerTimezone: input.attendeeTimezone,
  });
  const startIso = requestedStart.toISOString();
  if (!(slotsByDate[dateIso] ?? []).includes(startIso)) {
    throw Conflict("That time is no longer available");
  }

  let created;
  try {
    created = await prisma.$transaction(
      async (tx) => {
        // Re-check inside the transaction so a concurrent insert can't sneak in.
        const overlap = await tx.booking.findFirst({
          where: {
            eventTypeId: eventType.id,
            status: "CONFIRMED",
            startTime: { lt: requestedEnd },
            endTime: { gt: requestedStart },
          },
          select: { id: true },
        });
        if (overlap) throw Conflict("That time is no longer available");

        return tx.booking.create({
          data: {
            eventTypeId: eventType.id,
            attendeeName: input.attendeeName,
            attendeeEmail: input.attendeeEmail,
            attendeeNotes: input.attendeeNotes ?? null,
            attendeeTimezone: input.attendeeTimezone,
            guests: dedupedGuests(input.guests, input.attendeeEmail),
            startTime: requestedStart,
            endTime: requestedEnd,
          },
        });
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );
  } catch (err) {
    if (
      err instanceof Prisma.PrismaClientKnownRequestError &&
      err.code === "P2034" // transaction conflict
    ) {
      throw Conflict("That time is no longer available");
    }
    throw err;
  }

  // Fire-and-forget so an email outage never breaks the booking write.
  fireAndForget(notifyBookingCreated(created.id));
  return created;
}

export async function cancelBooking(id: string, reason?: string | null) {
  const booking = await prisma.booking.findUnique({ where: { id } });
  if (!booking) throw NotFound("Booking not found");
  if (booking.status === "CANCELLED") return booking;

  const updated = await prisma.booking.update({
    where: { id },
    data: {
      status: "CANCELLED",
      cancelledAt: new Date(),
      cancelReason: reason ?? null,
    },
  });
  fireAndForget(notifyBookingCancelled(updated.id, reason ?? null));
  return updated;
}

/**
 * Reschedule = cancel the old booking and create a new one carrying the same attendee.
 * Implemented as a single transaction so the old slot is freed before the new
 * one is created (otherwise the old booking would block the new time if the
 * attendee happens to want a slot that overlaps with their existing one).
 */
export async function rescheduleBooking(id: string, newStartIso: string, reason?: string | null) {
  const existing = await prisma.booking.findUnique({
    where: { id },
    include: { eventType: true },
  });
  if (!existing) throw NotFound("Booking not found");
  if (existing.status !== "CONFIRMED") throw BadRequest("Only confirmed bookings can be rescheduled");

  const newStart = new Date(newStartIso);
  if (Number.isNaN(newStart.getTime())) throw BadRequest("Invalid startTime");
  if (newStart.getTime() <= Date.now()) throw BadRequest("Cannot reschedule to the past");
  const newEnd = new Date(newStart.getTime() + existing.eventType.durationMinutes * 60_000);

  let created;
  try {
    created = await prisma.$transaction(
      async (tx) => {
        // Mark old as rescheduled (frees the time slot).
        await tx.booking.update({
          where: { id: existing.id },
          data: { status: "RESCHEDULED", cancelledAt: new Date() },
        });

        const overlap = await tx.booking.findFirst({
          where: {
            eventTypeId: existing.eventTypeId,
            status: "CONFIRMED",
            startTime: { lt: newEnd },
            endTime: { gt: newStart },
          },
          select: { id: true },
        });
        if (overlap) throw Conflict("That time is no longer available");

        const inserted = await tx.booking.create({
          data: {
            eventTypeId: existing.eventTypeId,
            attendeeName: existing.attendeeName,
            attendeeEmail: existing.attendeeEmail,
            attendeeNotes: existing.attendeeNotes,
            attendeeTimezone: existing.attendeeTimezone,
            guests: existing.guests,
            rescheduleReason: reason?.trim() || null,
            startTime: newStart,
            endTime: newEnd,
          },
        });

        await tx.booking.update({
          where: { id: existing.id },
          data: { rescheduledToId: inserted.id },
        });

        return inserted;
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );
  } catch (err) {
    if (
      err instanceof Prisma.PrismaClientKnownRequestError &&
      err.code === "P2034"
    ) {
      throw Conflict("That time is no longer available");
    }
    throw err;
  }

  fireAndForget(notifyBookingRescheduled(existing.id, created.id));
  return created;
}
