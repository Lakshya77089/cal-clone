import { describe, it, expect } from "vitest";
import { subtractIntervals } from "../../src/services/availability";

// Helper: 24-hour interval anchored on 2026-05-21 (a Thursday).
const d = (h: number, m = 0) => new Date(Date.UTC(2026, 4, 21, h, m));
const iv = (sh: number, eh: number, sm = 0, em = 0) => ({
  start: d(sh, sm),
  end: d(eh, em),
});

describe("subtractIntervals", () => {
  it("returns the open interval untouched when nothing is taken", () => {
    const free = subtractIntervals([iv(9, 17)], []);
    expect(free).toEqual([iv(9, 17)]);
  });

  it("removes a fully-contained booking, leaving two pieces", () => {
    const free = subtractIntervals([iv(9, 17)], [iv(10, 11)]);
    expect(free).toEqual([iv(9, 10), iv(11, 17)]);
  });

  it("removes booking flush against the start", () => {
    const free = subtractIntervals([iv(9, 17)], [iv(9, 10)]);
    expect(free).toEqual([iv(10, 17)]);
  });

  it("removes booking flush against the end", () => {
    const free = subtractIntervals([iv(9, 17)], [iv(16, 17)]);
    expect(free).toEqual([iv(9, 16)]);
  });

  it("returns nothing when booking fully covers the open interval", () => {
    const free = subtractIntervals([iv(9, 17)], [iv(8, 18)]);
    expect(free).toEqual([]);
  });

  it("ignores bookings that don't overlap at all", () => {
    const free = subtractIntervals([iv(9, 17)], [iv(20, 21)]);
    expect(free).toEqual([iv(9, 17)]);
  });

  it("handles multiple bookings in arbitrary order", () => {
    const free = subtractIntervals(
      [iv(9, 17)],
      [iv(14, 15), iv(10, 10, 0, 30)], // unsorted, second booking is 10:00-10:30
    );
    expect(free).toEqual([
      iv(9, 10, 0, 0),
      { start: d(10, 30), end: d(14) },
      iv(15, 17),
    ]);
  });

  it("handles multiple open intervals (e.g. 9-12, 13-17 split by lunch)", () => {
    const free = subtractIntervals(
      [iv(9, 12), iv(13, 17)],
      [iv(10, 10, 0, 30), iv(14, 15)],
    );
    expect(free).toEqual([
      iv(9, 10, 0, 0),
      { start: d(10, 30), end: d(12) },
      iv(13, 14),
      iv(15, 17),
    ]);
  });

  it("treats a booking that touches at a single point as no overlap", () => {
    // Booking ends exactly when next open interval starts → no subtraction.
    const free = subtractIntervals([iv(9, 17)], [iv(9, 9)]);
    expect(free).toEqual([iv(9, 17)]);
  });
});
