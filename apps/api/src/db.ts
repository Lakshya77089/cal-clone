import { PrismaClient } from "@prisma/client";

declare global {
  // eslint-disable-next-line no-var
  var __prisma: PrismaClient | undefined;
}

// Log level by environment:
//   - development: warn + error (helpful while iterating)
//   - test:        silent (the test runner has its own failure reporting;
//                  showing Prisma's `error` logs spams the output with
//                  P2034 "transaction failed to commit" lines that are
//                  intentional in the concurrency test)
//   - production:  error only
const logLevels: Array<"warn" | "error" | "query" | "info"> =
  process.env.NODE_ENV === "development"
    ? ["warn", "error"]
    : process.env.NODE_ENV === "test"
      ? []
      : ["error"];

export const prisma =
  global.__prisma ?? new PrismaClient({ log: logLevels });

if (process.env.NODE_ENV !== "production") {
  global.__prisma = prisma;
}
