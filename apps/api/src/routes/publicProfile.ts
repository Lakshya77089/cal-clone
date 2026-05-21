import { Router } from "express";
import { prisma } from "../db";
import { NotFound } from "../lib/errors";

const router = Router();

/**
 * Public profile listing — shows the user's bookable event types.
 * Hidden event types are filtered out (matches cal.com's behavior; hidden
 * events are still reachable via their direct /:username/:slug link).
 */
router.get("/:username", async (req, res, next) => {
  try {
    const user = await prisma.user.findUnique({
      where: { username: req.params.username },
    });
    if (!user) throw NotFound("User not found");

    const eventTypes = await prisma.eventType.findMany({
      where: { userId: user.id, hidden: false },
      orderBy: { createdAt: "asc" },
      select: {
        id: true,
        title: true,
        slug: true,
        description: true,
        durationMinutes: true,
      },
    });

    res.json({
      user: {
        name: user.name,
        username: user.username,
        timezoneDefault: user.timezoneDefault,
      },
      eventTypes,
    });
  } catch (e) {
    next(e);
  }
});

router.get("/:username/:slug", async (req, res, next) => {
  try {
    const { username, slug } = req.params;
    const user = await prisma.user.findUnique({ where: { username } });
    if (!user) throw NotFound("User not found");

    // Direct link works even for `hidden` events — that's the whole point
    // of cal.com's "secret event type" feature.
    const eventType = await prisma.eventType.findFirst({
      where: { userId: user.id, slug },
      include: { schedule: { select: { timezone: true } } },
    });
    if (!eventType) throw NotFound("Event type not found");

    res.json({
      user: {
        name: user.name,
        username: user.username,
        timezoneDefault: user.timezoneDefault,
      },
      eventType: {
        id: eventType.id,
        userId: eventType.userId,
        title: eventType.title,
        slug: eventType.slug,
        description: eventType.description,
        durationMinutes: eventType.durationMinutes,
        scheduleId: eventType.scheduleId,
        bufferBefore: eventType.bufferBefore,
        bufferAfter: eventType.bufferAfter,
        hidden: eventType.hidden,
        createdAt: eventType.createdAt,
      },
      scheduleTimezone: eventType.schedule.timezone,
    });
  } catch (e) {
    next(e);
  }
});

export default router;
