import { describe, it, expect, beforeEach, afterAll } from "vitest";
import { prisma } from "../../src/db";
import {
  cancelBooking,
  createBooking,
  rescheduleBooking,
} from "../../src/services/booking";
import { HttpError } from "../../src/lib/errors";
import { createBaseFixture, futureWorkdaySlotIso, resetDb } from "../helpers/fixtures";

describe("booking service (module test, hits real DB + transactions)", () => {
  beforeEach(async () => {
    await resetDb();
  });

  afterAll(async () => {
    await resetDb();
    await prisma.$disconnect();
  });

  describe("createBooking", () => {
    it("creates a CONFIRMED booking when the slot is open", async () => {
      const { eventType } = await createBaseFixture();
      const startIso = futureWorkdaySlotIso();
      const b = await createBooking({
        eventTypeId: eventType.id,
        startTime: startIso,
        attendeeName: "Alice",
        attendeeEmail: "alice@testhost.local",
        attendeeTimezone: "Asia/Kolkata",
      });
      expect(b.status).toBe("CONFIRMED");
      expect(b.startTime.toISOString()).toBe(startIso);
      // endTime = start + durationMinutes
      expect(b.endTime.getTime() - b.startTime.getTime()).toBe(30 * 60_000);
    });

    it("rejects a slot in the past", async () => {
      const { eventType } = await createBaseFixture();
      await expect(
        createBooking({
          eventTypeId: eventType.id,
          startTime: "2020-01-01T10:00:00.000Z",
          attendeeName: "X",
          attendeeEmail: "x@testhost.local",
          attendeeTimezone: "Asia/Kolkata",
        }),
      ).rejects.toMatchObject({ status: 400 });
    });

    it("rejects a slot outside the availability window", async () => {
      const { eventType } = await createBaseFixture();
      // 03:00 IST on a Mon = before 9 AM
      const day = futureWorkdaySlotIso().slice(0, 10);
      await expect(
        createBooking({
          eventTypeId: eventType.id,
          startTime: `${day}T21:30:00.000Z`, // 03:00 IST next day
          attendeeName: "X",
          attendeeEmail: "x@testhost.local",
          attendeeTimezone: "Asia/Kolkata",
        }),
      ).rejects.toBeInstanceOf(HttpError);
    });

    it("prevents double-booking the same slot", async () => {
      const { eventType } = await createBaseFixture();
      const slot = futureWorkdaySlotIso();
      await createBooking({
        eventTypeId: eventType.id,
        startTime: slot,
        attendeeName: "A",
        attendeeEmail: "a@testhost.local",
        attendeeTimezone: "Asia/Kolkata",
      });
      await expect(
        createBooking({
          eventTypeId: eventType.id,
          startTime: slot,
          attendeeName: "B",
          attendeeEmail: "b@testhost.local",
          attendeeTimezone: "Asia/Kolkata",
        }),
      ).rejects.toMatchObject({ status: 409 });
    });

    it("handles 5 concurrent bookings for the same slot — exactly one wins", async () => {
      const { eventType } = await createBaseFixture();
      const slot = futureWorkdaySlotIso();
      const attempts = Array.from({ length: 5 }, (_, i) =>
        createBooking({
          eventTypeId: eventType.id,
          startTime: slot,
          attendeeName: `Racer ${i}`,
          attendeeEmail: `racer${i}@testhost.local`,
          attendeeTimezone: "Asia/Kolkata",
        }).then(
          (b) => ({ ok: true as const, b }),
          (e) => ({ ok: false as const, e }),
        ),
      );
      const results = await Promise.all(attempts);
      const wins = results.filter((r) => r.ok);
      const losses = results.filter((r) => !r.ok);
      expect(wins).toHaveLength(1);
      expect(losses).toHaveLength(4);
      // DB invariant: only one row at that timestamp
      const dbRows = await prisma.booking.count({
        where: { eventTypeId: eventType.id, startTime: new Date(slot), status: "CONFIRMED" },
      });
      expect(dbRows).toBe(1);
    });

    it("allows back-to-back bookings when buffers are zero", async () => {
      const { eventType } = await createBaseFixture(); // duration 30, no buffer
      const start1 = futureWorkdaySlotIso();
      const start2 = new Date(new Date(start1).getTime() + 30 * 60_000).toISOString();
      await createBooking({
        eventTypeId: eventType.id,
        startTime: start1,
        attendeeName: "A",
        attendeeEmail: "a@testhost.local",
        attendeeTimezone: "Asia/Kolkata",
      });
      const b2 = await createBooking({
        eventTypeId: eventType.id,
        startTime: start2,
        attendeeName: "B",
        attendeeEmail: "b@testhost.local",
        attendeeTimezone: "Asia/Kolkata",
      });
      expect(b2.status).toBe("CONFIRMED");
    });
  });

  describe("cancelBooking", () => {
    it("soft-cancels and frees the slot", async () => {
      const { eventType } = await createBaseFixture();
      const slot = futureWorkdaySlotIso();
      const b = await createBooking({
        eventTypeId: eventType.id,
        startTime: slot,
        attendeeName: "A",
        attendeeEmail: "a@testhost.local",
        attendeeTimezone: "Asia/Kolkata",
      });
      const cancelled = await cancelBooking(b.id, "scope changed");
      expect(cancelled.status).toBe("CANCELLED");
      expect(cancelled.cancelReason).toBe("scope changed");
      expect(cancelled.cancelledAt).not.toBeNull();

      // Slot should now be re-bookable
      const b2 = await createBooking({
        eventTypeId: eventType.id,
        startTime: slot,
        attendeeName: "B",
        attendeeEmail: "b@testhost.local",
        attendeeTimezone: "Asia/Kolkata",
      });
      expect(b2.status).toBe("CONFIRMED");
    });

    it("is idempotent — second cancel keeps the first reason", async () => {
      const { eventType } = await createBaseFixture();
      const slot = futureWorkdaySlotIso();
      const b = await createBooking({
        eventTypeId: eventType.id,
        startTime: slot,
        attendeeName: "A",
        attendeeEmail: "a@testhost.local",
        attendeeTimezone: "Asia/Kolkata",
      });
      await cancelBooking(b.id, "first reason");
      const again = await cancelBooking(b.id, "different second reason");
      expect(again.cancelReason).toBe("first reason");
    });
  });

  describe("rescheduleBooking", () => {
    it("creates a new CONFIRMED booking and marks old as RESCHEDULED", async () => {
      const { eventType } = await createBaseFixture();
      const oldStart = futureWorkdaySlotIso();
      const newStart = new Date(
        new Date(oldStart).getTime() + 60 * 60_000,
      ).toISOString();
      const original = await createBooking({
        eventTypeId: eventType.id,
        startTime: oldStart,
        attendeeName: "A",
        attendeeEmail: "a@testhost.local",
        attendeeTimezone: "Asia/Kolkata",
      });

      const rescheduled = await rescheduleBooking(original.id, newStart);
      expect(rescheduled.status).toBe("CONFIRMED");
      expect(rescheduled.id).not.toBe(original.id);
      expect(rescheduled.startTime.toISOString()).toBe(newStart);

      const oldRow = await prisma.booking.findUniqueOrThrow({
        where: { id: original.id },
      });
      expect(oldRow.status).toBe("RESCHEDULED");
      expect(oldRow.rescheduledToId).toBe(rescheduled.id);
    });

    it("refuses to reschedule a cancelled booking", async () => {
      const { eventType } = await createBaseFixture();
      const slot = futureWorkdaySlotIso();
      const b = await createBooking({
        eventTypeId: eventType.id,
        startTime: slot,
        attendeeName: "A",
        attendeeEmail: "a@testhost.local",
        attendeeTimezone: "Asia/Kolkata",
      });
      await cancelBooking(b.id);
      const newStart = new Date(
        new Date(slot).getTime() + 60 * 60_000,
      ).toISOString();
      await expect(rescheduleBooking(b.id, newStart)).rejects.toMatchObject({
        status: 400,
      });
    });

    it("frees the old slot so it could be re-booked", async () => {
      const { eventType } = await createBaseFixture();
      const oldStart = futureWorkdaySlotIso();
      const newStart = new Date(
        new Date(oldStart).getTime() + 60 * 60_000,
      ).toISOString();
      const original = await createBooking({
        eventTypeId: eventType.id,
        startTime: oldStart,
        attendeeName: "A",
        attendeeEmail: "a@testhost.local",
        attendeeTimezone: "Asia/Kolkata",
      });
      await rescheduleBooking(original.id, newStart);

      // Old slot should now be free again
      const replay = await createBooking({
        eventTypeId: eventType.id,
        startTime: oldStart,
        attendeeName: "C",
        attendeeEmail: "c@testhost.local",
        attendeeTimezone: "Asia/Kolkata",
      });
      expect(replay.status).toBe("CONFIRMED");
    });
  });
});
