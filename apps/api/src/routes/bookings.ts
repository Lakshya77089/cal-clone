import { Router } from "express";
import {
  CancelBookingSchema,
  CreateBookingSchema,
  RescheduleBookingSchema,
} from "@cal/shared";
import { Prisma } from "@prisma/client";
import { prisma } from "../db";
import { validateBody } from "../middleware/validate";
import { getCurrentUser } from "../lib/currentUser";
import { NotFound } from "../lib/errors";
import {
  cancelBooking,
  createBooking,
  rescheduleBooking,
} from "../services/booking";

const router = Router();

router.get("/", async (req, res, next) => {
  try {
    const user = await getCurrentUser();
    const scope = (req.query.scope as string | undefined) ?? "upcoming";

    const now = new Date();
    const where: Prisma.BookingWhereInput = {
      eventType: { userId: user.id },
    };

    let orderBy: "asc" | "desc" = "asc";
    if (scope === "upcoming") {
      where.status = "CONFIRMED";
      where.startTime = { gte: now };
    } else if (scope === "past") {
      where.status = "CONFIRMED";
      where.startTime = { lt: now };
      orderBy = "desc";
    } else if (scope === "cancelled") {
      // Include both true cancellations and RESCHEDULED rows (the old
      // bookings that got moved). The "Rescheduled" badge differentiates
      // them in the UI, matching cal.com.
      where.status = { in: ["CANCELLED", "RESCHEDULED"] };
      orderBy = "desc";
    }

    const bookings = await prisma.booking.findMany({
      where,
      orderBy: { startTime: orderBy },
      include: {
        eventType: {
          select: { id: true, title: true, slug: true, durationMinutes: true },
        },
        rescheduledTo: { select: { id: true, status: true } },
        rescheduledFrom: { select: { id: true } },
      },
    });

    // Walk the rescheduled chain from `start` until we hit a booking whose
    // `rescheduledTo` is null/absent — that's the terminal. Bounded to 32
    // hops just in case of a cycle (shouldn't happen, defensive).
    const terminalStatus = async (
      startId: string,
    ): Promise<"CONFIRMED" | "CANCELLED" | "RESCHEDULED" | null> => {
      let id: string | null = startId;
      for (let i = 0; i < 32 && id; i++) {
        const node: { status: string; rescheduledToId: string | null } | null =
          await prisma.booking.findUnique({
            where: { id },
            select: { status: true, rescheduledToId: true },
          });
        if (!node) return null;
        if (node.status !== "RESCHEDULED") return node.status as never;
        id = node.rescheduledToId;
      }
      return null;
    };

    let shaped = bookings;
    if (scope === "cancelled") {
      // For each RESCHEDULED row in the cancelled list, walk to the
      // terminal — if the chain ends in CANCELLED, hide *all* RESCHEDULED
      // ancestors (the cancelled tail will show on its own).
      const keep: typeof bookings = [];
      for (const b of bookings) {
        if (b.status !== "RESCHEDULED") {
          keep.push(b);
          continue;
        }
        const tail = await terminalStatus(b.id);
        if (tail !== "CANCELLED") keep.push(b);
      }
      shaped = keep;
    }

    // Attach a `wasRescheduled` flag so the UI can pin the "Rescheduled"
    // badge on any row that's part of a reschedule chain — including the
    // terminal CONFIRMED row in Upcoming (cal.com does this too).
    const withFlag = shaped.map((b) => ({
      ...b,
      wasRescheduled:
        b.status === "RESCHEDULED" || b.rescheduledFrom != null,
    }));
    res.json(withFlag);
  } catch (e) {
    next(e);
  }
});

router.get("/:id", async (req, res, next) => {
  try {
    const booking = await prisma.booking.findUnique({
      where: { id: req.params.id },
      include: {
        eventType: {
          include: { user: { select: { name: true, username: true, email: true } } },
        },
        rescheduledFrom: {
          select: { id: true, startTime: true, endTime: true, attendeeEmail: true },
        },
      },
    });
    if (!booking) throw NotFound("Booking not found");
    res.json(booking);
  } catch (e) {
    next(e);
  }
});

router.post("/", validateBody(CreateBookingSchema), async (req, res, next) => {
  try {
    const booking = await createBooking(req.body);
    res.status(201).json(booking);
  } catch (e) {
    next(e);
  }
});

router.post("/:id/cancel", validateBody(CancelBookingSchema), async (req, res, next) => {
  try {
    const updated = await cancelBooking(req.params.id, req.body.reason);
    res.json(updated);
  } catch (e) {
    next(e);
  }
});

router.post("/:id/reschedule", validateBody(RescheduleBookingSchema), async (req, res, next) => {
  try {
    const created = await rescheduleBooking(req.params.id, req.body.startTime, req.body.reason);
    res.status(201).json(created);
  } catch (e) {
    next(e);
  }
});

export default router;
