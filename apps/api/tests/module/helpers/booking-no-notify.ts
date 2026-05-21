import { prisma } from "../../../src/db";

/**
 * Insert a confirmed booking directly via Prisma, bypassing the notifications
 * pipeline (which would try to hit EmailJS during tests).
 */
export async function createBookingNoNotify(eventTypeId: string, startIso: string) {
  const et = await prisma.eventType.findUniqueOrThrow({ where: { id: eventTypeId } });
  const start = new Date(startIso);
  const end = new Date(start.getTime() + et.durationMinutes * 60_000);
  return prisma.booking.create({
    data: {
      eventTypeId,
      attendeeName: "Module Test",
      attendeeEmail: "module@testhost.local",
      attendeeTimezone: "Asia/Kolkata",
      startTime: start,
      endTime: end,
    },
  });
}
