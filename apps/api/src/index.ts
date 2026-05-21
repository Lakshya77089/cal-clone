import "dotenv/config";
import express from "express";
import cors from "cors";
import eventTypesRouter from "./routes/eventTypes";
import schedulesRouter from "./routes/schedules";
import bookingsRouter from "./routes/bookings";
import slotsRouter from "./routes/slots";
import publicRouter from "./routes/publicProfile";
import meRouter from "./routes/me";
import { errorHandler } from "./middleware/errorHandler";

const app = express();

const origins = (process.env.WEB_ORIGIN ?? "http://localhost:3000")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);

app.use(cors({ origin: origins, credentials: false }));
app.use(express.json({ limit: "100kb" }));

app.get("/health", (_req, res) => {
  res.json({ status: "ok", uptime: process.uptime() });
});

app.use("/me", meRouter);
app.use("/event-types", eventTypesRouter);
app.use("/schedules", schedulesRouter);
app.use("/bookings", bookingsRouter);
app.use("/slots", slotsRouter);
app.use("/public", publicRouter);

app.use((_req, res) => res.status(404).json({ error: "Not found" }));
app.use(errorHandler);

const port = Number(process.env.PORT ?? 4000);
app.listen(port, () => {
  // eslint-disable-next-line no-console
  console.log(`[api] listening on http://localhost:${port}`);
});
