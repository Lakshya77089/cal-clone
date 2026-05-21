/**
 * Compose + send notification emails for booking lifecycle events.
 *
 * Each function fetches the related host/event-type info, builds the EmailJS
 * `template_params` for the generic booking template, then dispatches once to
 * the attendee and once to the host in parallel.
 *
 * Callers should use `fireAndForget()` (below) so a failed email never breaks
 * a booking write.
 */

import { formatInTimeZone } from "date-fns-tz";
import { prisma } from "../db";
import { sendTemplate } from "../lib/email";

type BookingForNotify = {
  id: string;
  attendeeName: string;
  attendeeEmail: string;
  attendeeTimezone: string;
  startTime: Date;
  endTime: Date;
  eventType: {
    title: string;
    user: { name: string; email: string };
  };
};

function appBaseUrl(): string {
  return (
    process.env.WEB_ORIGIN?.split(",")[0]?.trim() ||
    "http://localhost:3000"
  );
}

function formatWhen(start: Date, end: Date, tz: string): string {
  const day = formatInTimeZone(start, tz, "EEEE, MMMM d, yyyy");
  const startT = formatInTimeZone(start, tz, "h:mm a");
  const endT = formatInTimeZone(end, tz, "h:mm a");
  return `${day} · ${startT} – ${endT}`;
}

async function loadBooking(bookingId: string): Promise<BookingForNotify | null> {
  const b = await prisma.booking.findUnique({
    where: { id: bookingId },
    include: {
      eventType: {
        select: {
          title: true,
          user: { select: { name: true, email: true } },
        },
      },
    },
  });
  return b;
}

async function sendBothSides(
  booking: BookingForNotify,
  variables: {
    subject: string;
    headlineAttendee: string;
    headlineHost: string;
    intro: string;
    footer: string;
  },
) {
  const whenAttendee = formatWhen(
    booking.startTime,
    booking.endTime,
    booking.attendeeTimezone,
  );
  const bookingUrl = `${appBaseUrl()}/booking/${booking.id}`;

  const common = {
    subject: variables.subject,
    intro: variables.intro,
    event_title: booking.eventType.title,
    host_name: booking.eventType.user.name,
    attendee_name: booking.attendeeName,
    footer_note: variables.footer,
    booking_url: bookingUrl,
    from_name: "Cal Clone",
  };

  await Promise.all([
    sendTemplate({
      ...common,
      to_email: booking.attendeeEmail,
      to_name: booking.attendeeName,
      reply_to: booking.eventType.user.email,
      headline: variables.headlineAttendee,
      when_text: whenAttendee,
      timezone: booking.attendeeTimezone,
    }),
    sendTemplate({
      ...common,
      to_email: booking.eventType.user.email,
      to_name: booking.eventType.user.name,
      reply_to: booking.attendeeEmail,
      headline: variables.headlineHost,
      when_text: whenAttendee, // shown in attendee's tz; OK for an assignment demo
      timezone: booking.attendeeTimezone,
    }),
  ]);
}

export async function notifyBookingCreated(bookingId: string): Promise<void> {
  const booking = await loadBooking(bookingId);
  if (!booking) return;
  await sendBothSides(booking, {
    subject: `Booking confirmed: ${booking.eventType.title}`,
    headlineAttendee: "This meeting is scheduled",
    headlineHost: `New booking from ${booking.attendeeName}`,
    intro: `Your ${booking.eventType.title} with ${booking.eventType.user.name} is confirmed.`,
    footer:
      "Need to make changes? You can reschedule or cancel from the booking page.",
  });
}

export async function notifyBookingCancelled(
  bookingId: string,
  reason: string | null,
): Promise<void> {
  const booking = await loadBooking(bookingId);
  if (!booking) return;
  const reasonLine = reason?.trim()
    ? `Reason: ${reason.trim()}`
    : "No reason was provided.";
  await sendBothSides(booking, {
    subject: `Cancelled: ${booking.eventType.title}`,
    headlineAttendee: "This meeting was cancelled",
    headlineHost: `Cancelled booking with ${booking.attendeeName}`,
    intro: `The ${booking.eventType.title} previously scheduled has been cancelled.`,
    footer: reasonLine,
  });
}

export async function notifyBookingRescheduled(
  oldBookingId: string,
  newBookingId: string,
): Promise<void> {
  const [oldB, newB] = await Promise.all([
    loadBooking(oldBookingId),
    loadBooking(newBookingId),
  ]);
  if (!oldB || !newB) return;
  const oldWhen = formatWhen(oldB.startTime, oldB.endTime, oldB.attendeeTimezone);
  await sendBothSides(newB, {
    subject: `Rescheduled: ${newB.eventType.title}`,
    headlineAttendee: "This meeting was rescheduled",
    headlineHost: `Rescheduled booking with ${newB.attendeeName}`,
    intro: `The ${newB.eventType.title} has been moved to a new time.`,
    footer: `Previously: ${oldWhen}`,
  });
}

/**
 * Wrap a notification call so booking writes never fail because of an email
 * issue. Errors get logged but swallowed.
 */
export function fireAndForget(p: Promise<unknown>): void {
  p.catch((err) => {
    // eslint-disable-next-line no-console
    console.error("[notify] email send failed:", err);
  });
}
