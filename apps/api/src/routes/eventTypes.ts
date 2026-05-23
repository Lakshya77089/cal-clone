import { Router } from "express";
import { z } from "zod";
import { CreateEventTypeSchema, UpdateEventTypeSchema } from "@cal/shared";
import { prisma } from "../db";
import { validateBody } from "../middleware/validate";
import { getCurrentUser } from "../lib/currentUser";
import { BadRequest, NotFound } from "../lib/errors";
import { slugifyTitle, uniqueSlugForUser } from "../lib/slug";

const router = Router();

router.get("/", async (_req, res, next) => {
  try {
    const user = await getCurrentUser();
    const list = await prisma.eventType.findMany({
      where: { userId: user.id },
      orderBy: [{ position: "asc" }, { createdAt: "asc" }],
    });
    res.json(list);
  } catch (e) {
    next(e);
  }
});

const ReorderSchema = z.object({ ids: z.array(z.string().min(1)).min(1) });

router.post("/reorder", validateBody(ReorderSchema), async (req, res, next) => {
  try {
    const user = await getCurrentUser();
    const ids: string[] = req.body.ids;

    const owned = await prisma.eventType.findMany({
      where: { userId: user.id, id: { in: ids } },
      select: { id: true },
    });
    if (owned.length !== ids.length) {
      throw BadRequest("Reorder list contains unknown event types");
    }

    await prisma.$transaction(
      ids.map((id, i) =>
        prisma.eventType.update({ where: { id }, data: { position: i } }),
      ),
    );

    res.status(204).send();
  } catch (e) {
    next(e);
  }
});

router.get("/:id", async (req, res, next) => {
  try {
    const user = await getCurrentUser();
    const et = await prisma.eventType.findFirst({
      where: { id: req.params.id, userId: user.id },
    });
    if (!et) throw NotFound("Event type not found");
    res.json(et);
  } catch (e) {
    next(e);
  }
});

router.post("/", validateBody(CreateEventTypeSchema), async (req, res, next) => {
  try {
    const user = await getCurrentUser();
    const base = slugifyTitle(req.body.title);
    const slug = await uniqueSlugForUser(user.id, base);
    const created = await prisma.eventType.create({
      data: { ...req.body, slug, userId: user.id },
    });
    res.status(201).json(created);
  } catch (e) {
    next(e);
  }
});

router.patch("/:id", validateBody(UpdateEventTypeSchema), async (req, res, next) => {
  try {
    const user = await getCurrentUser();
    const existing = await prisma.eventType.findFirst({
      where: { id: req.params.id, userId: user.id },
    });
    if (!existing) throw NotFound("Event type not found");
    const updated = await prisma.eventType.update({
      where: { id: existing.id },
      data: req.body,
    });
    res.json(updated);
  } catch (e) {
    next(e);
  }
});

router.delete("/:id", async (req, res, next) => {
  try {
    const user = await getCurrentUser();
    const existing = await prisma.eventType.findFirst({
      where: { id: req.params.id, userId: user.id },
    });
    if (!existing) throw NotFound("Event type not found");
    await prisma.eventType.delete({ where: { id: existing.id } });
    res.status(204).send();
  } catch (e) {
    next(e);
  }
});

export default router;
