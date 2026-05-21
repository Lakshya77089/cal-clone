import { prisma } from "../db";
import { NotFound } from "./errors";

/**
 * No-auth simplification: there's exactly one user. The seed creates them.
 * Every admin route resolves "the current user" via this helper.
 */
export async function getCurrentUser() {
  const user = await prisma.user.findFirst({ orderBy: { createdAt: "asc" } });
  if (!user) throw NotFound("No user has been seeded yet — run `npm run seed`");
  return user;
}
