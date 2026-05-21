import { prisma } from "../db";
import { NotFound } from "../lib/errors";
import {
  dateAtMinuteInTz,
  eachDateInRange,
  isoDateInTz,
  weekdayInTz,
} from "../lib/time";
import type { SlotsResponse } from "@cal/shared";

const SLOT_GRID_MINUTES = 15; // Cal.com-style fixed grid

type Interval = { start: Date; end: Date };

/**
 * Compute bookable slot start times for a given event type within a date range.
 *
 * The algorithm:
 *   1. Resolve the event type's schedule, weekly rules, and date overrides.
 *   2. For each calendar date in the requested range (in the SCHEDULE's tz):
 *        a. If a DateOverride exists for that date → use it (or skip if blocked).
 *        b. Otherwise use the AvailabilityRules for that weekday.
 *        c. Convert each (start, end) minute pair into a UTC interval.
 *   3. Subtract all CONFIRMED bookings (with buffers applied) from those intervals.
 *   4. Slice the remaining intervals into start times stepped by min(duration, 15).
 *   5. Group output by calendar date in the VIEWER's timezone.
 */
export async function getAvailableSlots(args: {
  eventTypeId: string;
  fromIso: string; // YYYY-MM-DD
  toIso: string;
  viewerTimezone: string;
}): Promise<SlotsResponse> {
  const { eventTypeId, fromIso, toIso, viewerTimezone } = args;

  const eventType = await prisma.eventType.findUnique({
    where: { id: eventTypeId },
    include: {
      schedule: {
        include: { rules: true, overrides: true },
      },
    },
  });

  // `hidden` doesn't disable booking by direct link, so we don't gate on it.
  if (!eventType) throw NotFound("Event type not found");

  const sched = eventType.schedule;
  const tz = sched.timezone;
  const stepMinutes = Math.min(eventType.durationMinutes, SLOT_GRID_MINUTES);

  // Build a map: YYYY-MM-DD (in schedule tz) → list of open intervals (UTC).
  const overrideMap = new Map<string, { startMinute: number | null; endMinute: number | null }>();
  for (const o of sched.overrides) {
    const dateIso = isoDateInTz(o.date, "UTC"); // o.date is stored at midnight UTC
    overrideMap.set(dateIso, { startMinute: o.startMinute, endMinute: o.endMinute });
  }

  // Rules grouped by weekday for O(1) lookup.
  const rulesByWeekday: Map<number, { startMinute: number; endMinute: number }[]> = new Map();
  for (const r of sched.rules) {
    const arr = rulesByWeekday.get(r.weekday) ?? [];
    arr.push({ startMinute: r.startMinute, endMinute: r.endMinute });
    rulesByWeekday.set(r.weekday, arr);
  }

  // 1. Gather open intervals (UTC) for the whole range in the schedule timezone.
  const openIntervals: Interval[] = [];
  for (const dateIso of eachDateInRange(fromIso, toIso)) {
    const override = overrideMap.get(dateIso);
    if (override) {
      if (override.startMinute === null || override.endMinute === null) continue; // blocked
      openIntervals.push({
        start: dateAtMinuteInTz(dateIso, override.startMinute, tz),
        end: dateAtMinuteInTz(dateIso, override.endMinute, tz),
      });
      continue;
    }
    // No override → fall back to weekly rules.
    // The weekday is computed at noon-in-tz to dodge DST midnight edge cases.
    const noonUtc = dateAtMinuteInTz(dateIso, 12 * 60, tz);
    const wd = weekdayInTz(noonUtc, tz);
    const ranges = rulesByWeekday.get(wd) ?? [];
    for (const r of ranges) {
      openIntervals.push({
        start: dateAtMinuteInTz(dateIso, r.startMinute, tz),
        end: dateAtMinuteInTz(dateIso, r.endMinute, tz),
      });
    }
  }

  if (openIntervals.length === 0) return { slotsByDate: {} };

  // 2. Subtract booked intervals (with buffers).
  const rangeStart = openIntervals[0].start;
  const rangeEnd = openIntervals[openIntervals.length - 1].end;

  const existing = await prisma.booking.findMany({
    where: {
      eventTypeId,
      status: "CONFIRMED",
      endTime: { gt: rangeStart },
      startTime: { lt: rangeEnd },
    },
    select: { startTime: true, endTime: true },
  });

  const buffered: Interval[] = existing.map((b) => ({
    start: new Date(b.startTime.getTime() - eventType.bufferBefore * 60_000),
    end: new Date(b.endTime.getTime() + eventType.bufferAfter * 60_000),
  }));

  const free = subtractIntervals(openIntervals, buffered);

  // 3. Slice into discrete slot starts.
  const now = Date.now();
  const slots: Date[] = [];
  for (const iv of free) {
    let cursor = roundUpToGrid(iv.start, stepMinutes);
    while (cursor.getTime() + eventType.durationMinutes * 60_000 <= iv.end.getTime()) {
      if (cursor.getTime() > now) slots.push(cursor);
      cursor = new Date(cursor.getTime() + stepMinutes * 60_000);
    }
  }

  // 4. Group by calendar date in the viewer's timezone.
  const slotsByDate: Record<string, string[]> = {};
  for (const s of slots) {
    const key = isoDateInTz(s, viewerTimezone);
    (slotsByDate[key] ??= []).push(s.toISOString());
  }
  return { slotsByDate };
}

/** Round a Date up to the next multiple of `stepMinutes` minutes (in UTC). */
function roundUpToGrid(d: Date, stepMinutes: number): Date {
  const stepMs = stepMinutes * 60_000;
  const ms = d.getTime();
  return new Date(Math.ceil(ms / stepMs) * stepMs);
}

/** Subtract `taken` intervals from `open` intervals. Both arrays may be unsorted. */
export function subtractIntervals(open: Interval[], taken: Interval[]): Interval[] {
  const sortedOpen = [...open].sort((a, b) => a.start.getTime() - b.start.getTime());
  const sortedTaken = [...taken].sort((a, b) => a.start.getTime() - b.start.getTime());

  const result: Interval[] = [];
  for (const o of sortedOpen) {
    let pieces: Interval[] = [o];
    for (const t of sortedTaken) {
      const next: Interval[] = [];
      for (const p of pieces) {
        if (t.end <= p.start || t.start >= p.end) {
          next.push(p);
          continue;
        }
        if (t.start > p.start) next.push({ start: p.start, end: t.start });
        if (t.end < p.end) next.push({ start: t.end, end: p.end });
      }
      pieces = next;
      if (pieces.length === 0) break;
    }
    result.push(...pieces);
  }
  return result;
}
