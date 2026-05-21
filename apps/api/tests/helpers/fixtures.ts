import { prisma } from "../../src/db";

/**
 * Wipe all rows in dependency order. Used in beforeEach so each test starts
 * from a known empty state without dropping the schema.
 */
export async function resetDb() {
  await prisma.booking.deleteMany();
  await prisma.eventType.deleteMany();
  await prisma.dateOverride.deleteMany();
  await prisma.availabilityRule.deleteMany();
  await prisma.schedule.deleteMany();
  await prisma.user.deleteMany();
}

export type Fixture = Awaited<ReturnType<typeof createBaseFixture>>;

/**
 * Create the canonical test setup:
 *   * one user @testhost in Asia/Kolkata
 *   * one schedule "Work" (Mon-Fri 9-17 IST)
 *   * one event type "30min" (30-minute, no buffers)
 *
 * Tests can extend this and read the IDs back via the returned object.
 */
export async function createBaseFixture(options?: {
  durationMinutes?: number;
  bufferBefore?: number;
  bufferAfter?: number;
}) {
  const user = await prisma.user.create({
    data: {
      name: "Test Host",
      email: "host@testhost.local",
      username: "testhost",
      timezoneDefault: "Asia/Kolkata",
    },
  });

  const schedule = await prisma.schedule.create({
    data: {
      userId: user.id,
      name: "Work",
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

  const eventType = await prisma.eventType.create({
    data: {
      userId: user.id,
      title: "30 Minute Meeting",
      slug: "30min",
      durationMinutes: options?.durationMinutes ?? 30,
      scheduleId: schedule.id,
      bufferBefore: options?.bufferBefore ?? 0,
      bufferAfter: options?.bufferAfter ?? 0,
    },
  });

  return { user, schedule, eventType };
}

/** Convenience: a UTC ISO string for a future Mon-Fri 09:30 IST slot. */
export function futureWorkdaySlotIso(daysFromNow = 7): string {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() + daysFromNow);
  // Find a Mon-Fri (skip Sat/Sun in IST view; we approximate via UTC day).
  while (d.getUTCDay() === 0 || d.getUTCDay() === 6) {
    d.setUTCDate(d.getUTCDate() + 1);
  }
  // 09:30 IST == 04:00 UTC
  d.setUTCHours(4, 0, 0, 0);
  return d.toISOString();
}
