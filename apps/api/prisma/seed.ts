import { PrismaClient } from "@prisma/client";
import { randomBytes } from "node:crypto";

const prisma = new PrismaClient();

/** 6-char alphanumeric suffix, mirroring how cal.com tags anonymous links. */
function randomSuffix(): string {
  return randomBytes(4).toString("base64url").toLowerCase().replace(/[^a-z0-9]/g, "").slice(0, 6);
}

async function main() {
  // Idempotent: clear in dependency order, then re-create.
  await prisma.booking.deleteMany();
  await prisma.eventType.deleteMany();
  await prisma.dateOverride.deleteMany();
  await prisma.availabilityRule.deleteMany();
  await prisma.schedule.deleteMany();
  await prisma.user.deleteMany();

  const username = `lakshya-${randomSuffix()}`;
  const user = await prisma.user.create({
    data: {
      name: "Lakshya Sharma",
      email: "host@lakshyasharma.me",
      username,
      timezoneDefault: "Asia/Kolkata",
    },
  });

  // Working hours schedule: Mon-Fri 9-5 IST.
  const workSchedule = await prisma.schedule.create({
    data: {
      userId: user.id,
      name: "Working Hours",
      timezone: "Asia/Kolkata",
      isDefault: true,
      rules: {
        create: [1, 2, 3, 4, 5].map((weekday) => ({
          weekday,
          startMinute: 9 * 60,
          endMinute: 17 * 60,
        })),
      },
    },
  });

  // Weekends-only schedule for variety.
  const weekendSchedule = await prisma.schedule.create({
    data: {
      userId: user.id,
      name: "Weekends",
      timezone: "Asia/Kolkata",
      isDefault: false,
      rules: {
        create: [0, 6].map((weekday) => ({
          weekday,
          startMinute: 10 * 60,
          endMinute: 14 * 60,
        })),
      },
    },
  });

  const quickChat = await prisma.eventType.create({
    data: {
      userId: user.id,
      title: "15 Minute Meeting",
      slug: "15min",
      description: "A quick sync — perfect for introductions or short questions.",
      durationMinutes: 15,
      scheduleId: workSchedule.id,
      bufferAfter: 5,
    },
  });

  const standardCall = await prisma.eventType.create({
    data: {
      userId: user.id,
      title: "30 Minute Meeting",
      slug: "30min",
      description: "A focused 30-minute call.",
      durationMinutes: 30,
      scheduleId: workSchedule.id,
    },
  });

  await prisma.eventType.create({
    data: {
      userId: user.id,
      title: "Weekend Coffee",
      slug: "weekend-coffee",
      description: "Casual weekend chat over coffee.",
      durationMinutes: 45,
      scheduleId: weekendSchedule.id,
    },
  });

  // A couple of sample bookings so the dashboard isn't empty.
  const tomorrowAt10 = new Date();
  tomorrowAt10.setUTCDate(tomorrowAt10.getUTCDate() + 1);
  tomorrowAt10.setUTCHours(10 - 5, 30, 0, 0); // 10:00 IST ≈ 04:30 UTC

  await prisma.booking.create({
    data: {
      eventTypeId: standardCall.id,
      attendeeName: "Aisha Patel",
      attendeeEmail: "aisha@lakshyasharma.me",
      attendeeTimezone: "Asia/Kolkata",
      startTime: tomorrowAt10,
      endTime: new Date(tomorrowAt10.getTime() + 30 * 60_000),
    },
  });

  const lastWeek = new Date();
  lastWeek.setUTCDate(lastWeek.getUTCDate() - 7);
  lastWeek.setUTCHours(11 - 5, 30, 0, 0);

  await prisma.booking.create({
    data: {
      eventTypeId: quickChat.id,
      attendeeName: "Marco Rossi",
      attendeeEmail: "marco@lakshyasharma.me",
      attendeeTimezone: "Europe/Rome",
      startTime: lastWeek,
      endTime: new Date(lastWeek.getTime() + 15 * 60_000),
    },
  });

  // eslint-disable-next-line no-console
  console.log(`Seeded user @${user.username} with 3 event types and 2 sample bookings.`);
}

main()
  .catch((e) => {
    // eslint-disable-next-line no-console
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
