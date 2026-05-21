import type { ErrorRequestHandler } from "express";
import { Prisma } from "@prisma/client";
import { HttpError } from "../lib/errors";

export const errorHandler: ErrorRequestHandler = (err, _req, res, _next) => {
  if (err instanceof HttpError) {
    res.status(err.status).json({ error: err.message, details: err.details });
    return;
  }
  if (err instanceof Prisma.PrismaClientKnownRequestError) {
    if (err.code === "P2002") {
      res.status(409).json({ error: "A record with these values already exists" });
      return;
    }
    if (err.code === "P2025") {
      res.status(404).json({ error: "Record not found" });
      return;
    }
  }
  // eslint-disable-next-line no-console
  console.error("[api] unhandled error:", err);
  res.status(500).json({ error: "Internal server error" });
};
