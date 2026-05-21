import { describe, it, expect } from "vitest";
import { slugifyTitle } from "../../src/lib/slug";

describe("slugifyTitle", () => {
  it("lowercases and joins words with hyphens", () => {
    expect(slugifyTitle("Coffee Chat")).toBe("coffee-chat");
  });

  it("preserves digits", () => {
    expect(slugifyTitle("15 Minute Meeting")).toBe("15-minute-meeting");
  });

  it("collapses runs of whitespace and hyphens", () => {
    expect(slugifyTitle("Quick    Sync --  Now")).toBe("quick-sync-now");
  });

  it("strips combining diacritics", () => {
    expect(slugifyTitle("Café à Paris")).toBe("cafe-a-paris");
  });

  it("drops emoji and other non-ascii symbols", () => {
    expect(slugifyTitle("🎉 Launch Party 🎉")).toBe("launch-party");
  });

  it("falls back to 'event' for an all-symbol title", () => {
    expect(slugifyTitle("🎉🎉🎉")).toBe("event");
    expect(slugifyTitle("!!!")).toBe("event");
  });

  it("trims to 60 chars max", () => {
    const long = "a".repeat(120);
    expect(slugifyTitle(long).length).toBeLessThanOrEqual(60);
  });

  it("drops leading/trailing whitespace", () => {
    expect(slugifyTitle("   spaced   ")).toBe("spaced");
  });
});
