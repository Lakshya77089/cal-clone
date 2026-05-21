import type { NextFunction, Request, Response } from "express";
import type { ZodSchema } from "zod";
import { BadRequest } from "../lib/errors";

export function validateBody<T>(schema: ZodSchema<T>) {
  return (req: Request, _res: Response, next: NextFunction) => {
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) {
      return next(BadRequest("Invalid request body", parsed.error.flatten()));
    }
    req.body = parsed.data as unknown;
    next();
  };
}

export function validateQuery<T>(schema: ZodSchema<T>) {
  return (req: Request, _res: Response, next: NextFunction) => {
    const parsed = schema.safeParse(req.query);
    if (!parsed.success) {
      return next(BadRequest("Invalid query params", parsed.error.flatten()));
    }
    (req as unknown as { validatedQuery: T }).validatedQuery = parsed.data;
    next();
  };
}

export function getValidatedQuery<T>(req: Request): T {
  return (req as unknown as { validatedQuery: T }).validatedQuery;
}
