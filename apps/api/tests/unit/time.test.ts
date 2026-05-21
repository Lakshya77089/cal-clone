import { describe, it, expect } from "vitest";
import {
  dateAtMinuteInTz,
  eachDateInRange,
  isoDateInTz,
  weekdayInTz,
} from "../../src/lib/time";

describe("time utilities", () => {
  describe("dateAtMinuteInTz", () => {
    it("converts wall-clock IST minute into the correct UTC Date", () => {
      // 9:00 AM IST on 2026-05-25 == 03:30 UTC
      const utc = dateAtMinuteInTz("2026-05-25", 9 * 60, "Asia/Kolkata");
      expect(utc.toISOString()).toBe("2026-05-25T03:30:00.000Z");
    });

    it("handles a non-rounded minute (e.g. 9:07)", () => {
      const utc = dateAtMinuteInTz("2026-05-25", 9 * 60 + 7, "Asia/Kolkata");
      expect(utc.toISOString()).toBe("2026-05-25T03:37:00.000Z");
    });

    it("treats different timezones differently for the same wall-clock", () => {
      const a = dateAtMinuteInTz("2026-05-25", 9 * 60, "Asia/Kolkata");
      const b = dateAtMinuteInTz("2026-05-25", 9 * 60, "America/New_York");
      // NY is 9.5h behind IST in May (NY in EDT = UTC-4, IST = UTC+5:30)
      expect(b.getTime() - a.getTime()).toBe(9.5 * 60 * 60 * 1000);
    });

    it("survives the DST spring-forward in America/New_York", () => {
      // 2026-03-08 02:30 NY local time doesn't exist — clocks jump 02:00 → 03:00.
      // fromZonedTime should map the request forward into UTC sensibly (no crash).
      const utc = dateAtMinuteInTz("2026-03-08", 2 * 60 + 30, "America/New_York");
      expect(utc).toBeInstanceOf(Date);
      expect(Number.isNaN(utc.getTime())).toBe(false);
    });
  });

  describe("isoDateInTz", () => {
    it("yields the correct calendar date in viewer's tz", () => {
      // 2026-05-25 03:30 UTC = 09:00 IST on the same date
      const d = new Date("2026-05-25T03:30:00.000Z");
      expect(isoDateInTz(d, "Asia/Kolkata")).toBe("2026-05-25");
    });

    it("rolls the date backward when viewer is far west", () => {
      // 2026-05-25 03:30 UTC = 2026-05-24 23:30 EDT
      const d = new Date("2026-05-25T03:30:00.000Z");
      expect(isoDateInTz(d, "America/New_York")).toBe("2026-05-24");
    });
  });

  describe("weekdayInTz", () => {
    it("returns 0..6 (Sun..Sat) per the viewer's tz", () => {
      // 2026-05-25 was a Monday in IST → 1
      const d = new Date("2026-05-25T06:00:00.000Z");
      expect(weekdayInTz(d, "Asia/Kolkata")).toBe(1);
    });
  });

  describe("eachDateInRange", () => {
    it("returns exactly one date when from === to", () => {
      expect(eachDateInRange("2026-05-25", "2026-05-25")).toEqual(["2026-05-25"]);
    });

    it("returns inclusive list across a few days", () => {
      expect(eachDateInRange("2026-05-25", "2026-05-28")).toEqual([
        "2026-05-25",
        "2026-05-26",
        "2026-05-27",
        "2026-05-28",
      ]);
    });

    it("doesn't suffer the date-fns startOfDay tz-shift bug that caused an earlier prod incident", () => {
      // Regression for the bug fixed in lib/time.ts: prior version walked
      // via date-fns startOfDay which treated input as runtime-local tz,
      // so on an IST machine `from=to=2026-05-25` returned ["2026-05-24"].
      const out = eachDateInRange("2026-05-25", "2026-05-25");
      expect(out).toEqual(["2026-05-25"]);
    });
  });
});
