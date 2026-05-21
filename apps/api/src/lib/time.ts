import { fromZonedTime, toZonedTime, format as formatTz } from "date-fns-tz";
import { addMinutes } from "date-fns";

/**
 * Build a UTC Date from a wall-clock (date, minute-of-day) pair in `timezone`.
 *
 * Example: dateAtMinuteInTz("2026-05-21", 540, "America/Los_Angeles")
 *          === 9:00 AM Pacific on May 21, 2026, as a UTC Date.
 */
export function dateAtMinuteInTz(
  isoDate: string, // YYYY-MM-DD (calendar date in `timezone`)
  minute: number,
  timezone: string,
): Date {
  const hh = Math.floor(minute / 60)
    .toString()
    .padStart(2, "0");
  const mm = (minute % 60).toString().padStart(2, "0");
  // Construct a naive wall-clock string, then interpret it as `timezone`.
  return fromZonedTime(`${isoDate}T${hh}:${mm}:00`, timezone);
}

/** YYYY-MM-DD calendar date of `utcDate` as seen in `timezone`. */
export function isoDateInTz(utcDate: Date, timezone: string): string {
  return formatTz(toZonedTime(utcDate, timezone), "yyyy-MM-dd", { timeZone: timezone });
}

/** Weekday 0..6 (Sunday..Saturday) of `utcDate` as seen in `timezone`. */
export function weekdayInTz(utcDate: Date, timezone: string): number {
  const z = toZonedTime(utcDate, timezone);
  return z.getDay();
}

/** Inclusive list of YYYY-MM-DD strings between `from` and `to`. */
export function eachDateInRange(fromIso: string, toIso: string): string[] {
  // Walk by-day at a fixed UTC anchor (12:00) so DST in the local runtime
  // timezone can never push us across a date boundary. Using midnight UTC
  // and a tz-aware `startOfDay` was the source of an earlier off-by-one bug.
  const out: string[] = [];
  let d = new Date(`${fromIso}T12:00:00Z`);
  const end = new Date(`${toIso}T12:00:00Z`);
  while (d.getTime() <= end.getTime()) {
    out.push(d.toISOString().slice(0, 10));
    d = new Date(d.getTime() + 24 * 60 * 60 * 1000);
  }
  return out;
}

export { addMinutes };
