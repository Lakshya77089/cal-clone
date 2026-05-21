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
      },
    });
    res.json(bookings);
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
          include: { user: { select: { name: true, username: true } } },
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
    const created = await rescheduleBooking(req.params.id, req.body.startTime);
    res.status(201).json(created);
  } catch (e) {
    next(e);
  }
});

export default router;
