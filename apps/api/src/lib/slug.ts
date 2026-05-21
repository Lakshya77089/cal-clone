import { prisma } from "../db";

/** Turn a title into a URL-safe slug: "Café Chat ☕" → "cafe-chat". */
export function slugifyTitle(title: string): string {
  const slug = title
    .toLowerCase()
    .normalize("NFKD")
    // Strip combining diacritical marks (the "´" in "é" after NFKD).
    // Using \u escapes so the regex survives any editor's encoding.
    .replace(/[̀-ͯ]/g, "")
    // Drop anything that isn't ASCII letters, digits, spaces, or hyphens.
    .replace(/[^a-z0-9\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .slice(0, 60);
  // Guard against an empty result (e.g. emoji-only titles, all-symbol titles).
  return slug || "event";
}

/**
 * Return a slug unique within (userId, slug). If `base` is taken, append -2, -3, …
 * until a free one is found.
 */
export async function uniqueSlugForUser(userId: string, base: string): Promise<string> {
  let candidate = base;
  let n = 2;
  // eslint-disable-next-line no-constant-condition
  while (true) {
    const collision = await prisma.eventType.findUnique({
      where: { userId_slug: { userId, slug: candidate } },
      select: { id: true },
    });
    if (!collision) return candidate;
    candidate = `${base}-${n++}`;
  }
}
