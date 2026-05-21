import { describe, it, expect, beforeAll, beforeEach, afterAll } from "vitest";
import { prisma } from "../../src/db";
import { getAvailableSlots } from "../../src/services/availability";
import { createBookingNoNotify } from "./helpers/booking-no-notify";
import { createBaseFixture, futureWorkdaySlotIso, resetDb } from "../helpers/fixtures";

describe("getAvailableSlots (module test, hits real DB)", () => {
  beforeAll(async () => {
    await resetDb();
  });

  afterAll(async () => {
    await resetDb();
    await prisma.$disconnect();
  });

  beforeEach(async () => {
    await resetDb();
  });

  it("returns ~32 slots for a single Mon-Fri workday (9-17 IST, 30min event, 15min grid)", async () => {
    const { eventType } = await createBaseFixture({ durationMinutes: 30 });
    // 9:00 IST to 17:00 IST = 8 hours = 480 min.
    // With 30min duration on a 15min grid, last valid start = 16:30 IST.
    // So starts at 09:00, 09:15, 09:30, …, 16:30 → 31 slots.
    const result = await getAvailableSlots({
      eventTypeId: eventType.id,
      fromIso: "2026-05-25", // Mon
      toIso: "2026-05-25",
      viewerTimezone: "Asia/Kolkata",
    });
    const count = (result.slotsByDate["2026-05-25"] ?? []).length;
    expect(count).toBe(31);
  });

  it("returns 0 slots for a weekend day (no rule for Sun/Sat)", async () => {
    const { eventType } = await createBaseFixture();
    const result = await getAvailableSlots({
      eventTypeId: eventType.id,
      fromIso: "2026-05-24", // Sun
      toIso: "2026-05-24",
      viewerTimezone: "Asia/Kolkata",
    });
    expect(result.slotsByDate["2026-05-24"]).toBeUndefined();
  });

  it("subtracts an existing booking from the available set", async () => {
    const { eventType } = await createBaseFixture();
    const slotIso = futureWorkdaySlotIso(7);
    await createBookingNoNotify(eventType.id, slotIso);

    const dateIso = slotIso.slice(0, 10);
    const result = await getAvailableSlots({
      eventTypeId: eventType.id,
      fromIso: dateIso,
      toIso: dateIso,
      viewerTimezone: "UTC",
    });
    const slots = result.slotsByDate[dateIso] ?? [];
    expect(slots).not.toContain(slotIso);
  });

  it("DateOverride with both minutes null fully blocks the day", async () => {
    const { eventType, schedule } = await createBaseFixture();
    // Mon 2026-05-25 — block fully.
    await prisma.dateOverride.create({
      data: {
        scheduleId: schedule.id,
        date: new Date("2026-05-25T00:00:00Z"),
        startMinute: null,
        endMinute: null,
      },
    });
    const result = await getAvailableSlots({
      eventTypeId: eventType.id,
      fromIso: "2026-05-25",
      toIso: "2026-05-25",
      viewerTimezone: "Asia/Kolkata",
    });
    expect(result.slotsByDate["2026-05-25"]).toBeUndefined();
  });

  it("DateOverride with custom hours replaces the weekly rule", async () => {
    const { eventType, schedule } = await createBaseFixture();
    // 2026-05-25 (Mon): only 10:00-11:00 IST instead of 9-17.
    await prisma.dateOverride.create({
      data: {
        scheduleId: schedule.id,
        date: new Date("2026-05-25T00:00:00Z"),
        startMinute: 10 * 60,
        endMinute: 11 * 60,
      },
    });
    const result = await getAvailableSlots({
      eventTypeId: eventType.id,
      fromIso: "2026-05-25",
      toIso: "2026-05-25",
      viewerTimezone: "Asia/Kolkata",
    });
    // 10:00-11:00 = 60 min, 30min event on 15min grid: 10:00, 10:15, 10:30 → 3 slots
    const count = (result.slotsByDate["2026-05-25"] ?? []).length;
    expect(count).toBe(3);
  });

  it("buffer time blocks adjacent slots around an existing booking", async () => {
    const { eventType } = await createBaseFixture({
      durationMinutes: 30,
      bufferBefore: 15,
      bufferAfter: 15,
    });
    // Future Mon, 10:00 IST = 04:30 UTC.
    const day = futureWorkdaySlotIso(7).slice(0, 10);
    const bookingStart = `${day}T04:30:00.000Z`; // 10:00 IST
    await createBookingNoNotify(eventType.id, bookingStart);

    const result = await getAvailableSlots({
      eventTypeId: eventType.id,
      fromIso: day,
      toIso: day,
      viewerTimezone: "UTC",
    });
    const slots = result.slotsByDate[day] ?? [];

    // Booking is 10:00-10:30 IST. With 15min buffer before+after, the
    // blocked zone is 09:45-10:45. A 30min event can't start at 09:30 or 10:30.
    expect(slots).not.toContain(`${day}T04:00:00.000Z`); // 09:30 IST (would end inside buffer)
    expect(slots).not.toContain(`${day}T04:15:00.000Z`); // 09:45 IST (start = buffer start)
    expect(slots).not.toContain(`${day}T05:00:00.000Z`); // 10:30 IST (inside buffer-after)
    expect(slots).toContain(`${day}T05:15:00.000Z`); // 10:45 IST (just after buffer)
  });
});
