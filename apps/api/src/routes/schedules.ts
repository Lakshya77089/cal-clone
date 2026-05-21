import { Router } from "express";
import { CreateScheduleSchema, UpdateScheduleSchema } from "@cal/shared";
import { prisma } from "../db";
import { validateBody } from "../middleware/validate";
import { getCurrentUser } from "../lib/currentUser";
import { NotFound } from "../lib/errors";

const router = Router();

router.get("/", async (_req, res, next) => {
  try {
    const user = await getCurrentUser();
    const list = await prisma.schedule.findMany({
      where: { userId: user.id },
      include: { rules: true, overrides: true },
      orderBy: { createdAt: "asc" },
    });
    res.json(list.map(serializeSchedule));
  } catch (e) {
    next(e);
  }
});

router.get("/:id", async (req, res, next) => {
  try {
    const user = await getCurrentUser();
    const sched = await prisma.schedule.findFirst({
      where: { id: req.params.id, userId: user.id },
      include: { rules: true, overrides: true },
    });
    if (!sched) throw NotFound("Schedule not found");
    res.json(serializeSchedule(sched));
  } catch (e) {
    next(e);
  }
});

router.post("/", validateBody(CreateScheduleSchema), async (req, res, next) => {
  try {
    const user = await getCurrentUser();
    const { rules, overrides, ...rest } = req.body;
    const created = await prisma.schedule.create({
      data: {
        ...rest,
        userId: user.id,
        rules: { create: rules },
        overrides: {
          create: overrides.map((o: { date: string; startMinute: number | null; endMinute: number | null }) => ({
            date: new Date(`${o.date}T00:00:00Z`),
            startMinute: o.startMinute,
            endMinute: o.endMinute,
          })),
        },
      },
      include: { rules: true, overrides: true },
    });
    res.status(201).json(serializeSchedule(created));
  } catch (e) {
    next(e);
  }
});

router.patch("/:id", validateBody(UpdateScheduleSchema), async (req, res, next) => {
  try {
    const user = await getCurrentUser();
    const existing = await prisma.schedule.findFirst({
      where: { id: req.params.id, userId: user.id },
    });
    if (!existing) throw NotFound("Schedule not found");

    const { rules, overrides, ...rest } = req.body;

    const updated = await prisma.$transaction(async (tx) => {
      await tx.schedule.update({
        where: { id: existing.id },
        data: rest,
      });

      // Replace-on-write semantics for the child collections — keeps the
      // editor UI simple (POST the whole list, server replaces). Matches
      // how Cal.com's availability editor saves.
      if (rules) {
        await tx.availabilityRule.deleteMany({ where: { scheduleId: existing.id } });
        if (rules.length) {
          await tx.availabilityRule.createMany({
            data: rules.map((r: { weekday: number; startMinute: number; endMinute: number }) => ({
              ...r,
              scheduleId: existing.id,
            })),
          });
        }
      }
      if (overrides) {
        await tx.dateOverride.deleteMany({ where: { scheduleId: existing.id } });
        if (overrides.length) {
          await tx.dateOverride.createMany({
            data: overrides.map(
              (o: { date: string; startMinute: number | null; endMinute: number | null }) => ({
                scheduleId: existing.id,
                date: new Date(`${o.date}T00:00:00Z`),
                startMinute: o.startMinute,
                endMinute: o.endMinute,
              }),
            ),
          });
        }
      }

      return tx.schedule.findUniqueOrThrow({
        where: { id: existing.id },
        include: { rules: true, overrides: true },
      });
    });

    res.json(serializeSchedule(updated));
  } catch (e) {
    next(e);
  }
});

router.delete("/:id", async (req, res, next) => {
  try {
    const user = await getCurrentUser();
    const existing = await prisma.schedule.findFirst({
      where: { id: req.params.id, userId: user.id },
    });
    if (!existing) throw NotFound("Schedule not found");
    await prisma.schedule.delete({ where: { id: existing.id } });
    res.status(204).send();
  } catch (e) {
    next(e);
  }
});

type ScheduleRow = {
  id: string;
  userId: string;
  name: string;
  timezone: string;
  isDefault: boolean;
  rules: { id: string; weekday: number; startMinute: number; endMinute: number }[];
  overrides: { id: string; date: Date; startMinute: number | null; endMinute: number | null }[];
};

function serializeSchedule(s: ScheduleRow) {
  return {
    id: s.id,
    userId: s.userId,
    name: s.name,
    timezone: s.timezone,
    isDefault: s.isDefault,
    rules: s.rules.map((r) => ({
      id: r.id,
      weekday: r.weekday,
      startMinute: r.startMinute,
      endMinute: r.endMinute,
    })),
    overrides: s.overrides.map((o) => ({
      id: o.id,
      date: o.date.toISOString().slice(0, 10),
      startMinute: o.startMinute,
      endMinute: o.endMinute,
    })),
  };
}

export default router;
