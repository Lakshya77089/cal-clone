import { Router } from "express";
import { getCurrentUser } from "../lib/currentUser";

const router = Router();

router.get("/", async (_req, res, next) => {
  try {
    const user = await getCurrentUser();
    res.json({
      id: user.id,
      name: user.name,
      email: user.email,
      username: user.username,
      timezoneDefault: user.timezoneDefault,
    });
  } catch (e) {
    next(e);
  }
});

export default router;
