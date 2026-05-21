import { Router } from "express";
import { SlotsQuerySchema } from "@cal/shared";
import { getValidatedQuery, validateQuery } from "../middleware/validate";
import { getAvailableSlots } from "../services/availability";
import { prisma } from "../db";
import { NotFound } from "../lib/errors";

const router = Router();

router.get("/", validateQuery(SlotsQuerySchema), async (req, res, next) => {
  try {
    const q = getValidatedQuery<{
      eventTypeId: string;
      from: string;
      to: string;
      timezone?: string;
    }>(req);

    // If no viewer timezone provided, fall back to the schedule's timezone.
    let viewerTimezone = q.timezone;
    if (!viewerTimezone) {
      const et = await prisma.eventType.findUnique({
        where: { id: q.eventTypeId },
        include: { schedule: { select: { timezone: true } } },
      });
      if (!et) throw NotFound("Event type not found");
      viewerTimezone = et.schedule.timezone;
    }

    const result = await getAvailableSlots({
      eventTypeId: q.eventTypeId,
      fromIso: q.from,
      toIso: q.to,
      viewerTimezone,
    });
    res.json(result);
  } catch (e) {
    next(e);
  }
});

export default router;
