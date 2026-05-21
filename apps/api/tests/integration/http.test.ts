import { describe, it, expect, beforeAll, beforeEach, afterAll } from "vitest";
import request from "supertest";
import { createApp } from "../../src/app";
import { prisma } from "../../src/db";
import { createBaseFixture, futureWorkdaySlotIso, resetDb } from "../helpers/fixtures";

const app = createApp();

describe("HTTP API (integration, real DB)", () => {
  beforeAll(async () => {
    await resetDb();
  });
  beforeEach(async () => {
    await resetDb();
  });
  afterAll(async () => {
    await resetDb();
    await prisma.$disconnect();
  });

  describe("GET /health", () => {
    it("returns 200 even without DB or seed", async () => {
      const res = await request(app).get("/health");
      expect(res.status).toBe(200);
      expect(res.body.status).toBe("ok");
    });
  });

  describe("GET /me", () => {
    it("404s with a clear message when no user is seeded", async () => {
      const res = await request(app).get("/me");
      expect(res.status).toBe(404);
      expect(res.body.error).toMatch(/seeded/);
    });

    it("returns the seeded user", async () => {
      await createBaseFixture();
      const res = await request(app).get("/me");
      expect(res.status).toBe(200);
      expect(res.body.username).toBe("testhost");
    });
  });

  describe("Event Types", () => {
    it("POST /event-types creates with a slug derived from title (rejects user-supplied slug)", async () => {
      const { schedule } = await createBaseFixture();
      // Wipe the seeded event type so we start with 0
      await prisma.eventType.deleteMany();
      const res = await request(app)
        .post("/event-types")
        .send({
          title: "Coffee Chat",
          slug: "i-tried-to-set-this", // server should ignore
          durationMinutes: 30,
          scheduleId: schedule.id,
        });
      expect(res.status).toBe(201);
      expect(res.body.slug).toBe("coffee-chat");
    });

    it("appends -2 / -3 on slug collision", async () => {
      const { schedule } = await createBaseFixture();
      await prisma.eventType.deleteMany();
      await request(app).post("/event-types").send({
        title: "Coffee Chat",
        durationMinutes: 30,
        scheduleId: schedule.id,
      });
      const res2 = await request(app).post("/event-types").send({
        title: "Coffee Chat",
        durationMinutes: 30,
        scheduleId: schedule.id,
      });
      expect(res2.status).toBe(201);
      expect(res2.body.slug).toBe("coffee-chat-2");
    });

    it("PATCH ignores any slug in body — slug is immutable", async () => {
      const { eventType } = await createBaseFixture();
      const before = eventType.slug;
      const res = await request(app)
        .patch(`/event-types/${eventType.id}`)
        .send({ slug: "hacked", title: "Renamed" });
      expect(res.status).toBe(200);
      expect(res.body.slug).toBe(before);
      expect(res.body.title).toBe("Renamed");
    });

    it("PATCH hidden=true keeps the event reachable via direct link", async () => {
      const { user, eventType } = await createBaseFixture();
      await request(app)
        .patch(`/event-types/${eventType.id}`)
        .send({ hidden: true });
      const profile = await request(app).get(`/public/${user.username}`);
      expect(profile.status).toBe(200);
      // Hidden events filtered out of listing
      expect(profile.body.eventTypes.find((e: { slug: string }) => e.slug === eventType.slug))
        .toBeUndefined();
      // But direct link still resolves
      const direct = await request(app).get(
        `/public/${user.username}/${eventType.slug}`,
      );
      expect(direct.status).toBe(200);
    });

    it("DELETE 204s on a real id, 404s on a fake one", async () => {
      const { eventType } = await createBaseFixture();
      const ok = await request(app).delete(`/event-types/${eventType.id}`);
      expect(ok.status).toBe(204);
      const notFound = await request(app).delete("/event-types/does-not-exist");
      expect(notFound.status).toBe(404);
    });
  });

  describe("Bookings", () => {
    it("POST /bookings creates, then GET /bookings?scope=upcoming includes it", async () => {
      const { eventType } = await createBaseFixture();
      const slot = futureWorkdaySlotIso();
      const create = await request(app).post("/bookings").send({
        eventTypeId: eventType.id,
        startTime: slot,
        attendeeName: "Alice",
        attendeeEmail: "alice@testhost.local",
        attendeeTimezone: "Asia/Kolkata",
      });
      expect(create.status).toBe(201);
      const list = await request(app).get("/bookings?scope=upcoming");
      expect(list.status).toBe(200);
      expect(list.body.find((b: { id: string }) => b.id === create.body.id)).toBeTruthy();
    });

    it("second POST for the same slot returns 409", async () => {
      const { eventType } = await createBaseFixture();
      const slot = futureWorkdaySlotIso();
      await request(app).post("/bookings").send({
        eventTypeId: eventType.id,
        startTime: slot,
        attendeeName: "A",
        attendeeEmail: "a@testhost.local",
        attendeeTimezone: "Asia/Kolkata",
      });
      const second = await request(app).post("/bookings").send({
        eventTypeId: eventType.id,
        startTime: slot,
        attendeeName: "B",
        attendeeEmail: "b@testhost.local",
        attendeeTimezone: "Asia/Kolkata",
      });
      expect(second.status).toBe(409);
    });

    it("Cancelled tab excludes RESCHEDULED rows (regression for double-card bug)", async () => {
      const { eventType } = await createBaseFixture();
      const slot1 = futureWorkdaySlotIso();
      const slot2 = new Date(
        new Date(slot1).getTime() + 60 * 60_000,
      ).toISOString();

      // Book → reschedule → cancel the new one
      const original = await request(app).post("/bookings").send({
        eventTypeId: eventType.id,
        startTime: slot1,
        attendeeName: "A",
        attendeeEmail: "a@testhost.local",
        attendeeTimezone: "Asia/Kolkata",
      });
      const rescheduled = await request(app)
        .post(`/bookings/${original.body.id}/reschedule`)
        .send({ startTime: slot2 });
      await request(app)
        .post(`/bookings/${rescheduled.body.id}/cancel`)
        .send({ reason: "test" });

      const cancelled = await request(app).get("/bookings?scope=cancelled");
      expect(cancelled.status).toBe(200);
      // Should be exactly ONE card (the CANCELLED), not 2 (CANCELLED + RESCHEDULED)
      expect(cancelled.body).toHaveLength(1);
      expect(cancelled.body[0].status).toBe("CANCELLED");
    });

    it("validates request body and returns 400 with field errors", async () => {
      const { eventType } = await createBaseFixture();
      const res = await request(app).post("/bookings").send({
        eventTypeId: eventType.id,
        startTime: futureWorkdaySlotIso(),
        attendeeName: "A",
        attendeeEmail: "not-a-real-email",
        attendeeTimezone: "Asia/Kolkata",
      });
      expect(res.status).toBe(400);
      expect(res.body.details.fieldErrors.attendeeEmail).toBeTruthy();
    });
  });

  describe("Slots", () => {
    it("GET /slots returns slotsByDate keyed by viewer-tz date", async () => {
      const { eventType } = await createBaseFixture();
      const res = await request(app).get(
        `/slots?eventTypeId=${eventType.id}&from=2026-05-25&to=2026-05-25&timezone=Asia/Kolkata`,
      );
      expect(res.status).toBe(200);
      expect(res.body.slotsByDate).toHaveProperty("2026-05-25");
      expect(res.body.slotsByDate["2026-05-25"].length).toBeGreaterThan(0);
    });

    it("rejects malformed date params with 400", async () => {
      const { eventType } = await createBaseFixture();
      const res = await request(app).get(
        `/slots?eventTypeId=${eventType.id}&from=not-a-date&to=2026-05-25`,
      );
      expect(res.status).toBe(400);
    });
  });

  describe("Public profile", () => {
    it("GET /public/:username includes only non-hidden events", async () => {
      const { user, schedule } = await createBaseFixture();
      await prisma.eventType.create({
        data: {
          userId: user.id,
          title: "Hidden Event",
          slug: "hidden",
          durationMinutes: 15,
          scheduleId: schedule.id,
          hidden: true,
        },
      });
      const res = await request(app).get(`/public/${user.username}`);
      expect(res.status).toBe(200);
      const slugs = res.body.eventTypes.map((e: { slug: string }) => e.slug);
      expect(slugs).toContain("30min");
      expect(slugs).not.toContain("hidden");
    });

    it("404s for an unknown username", async () => {
      await createBaseFixture();
      const res = await request(app).get("/public/nope");
      expect(res.status).toBe(404);
    });
  });
});
