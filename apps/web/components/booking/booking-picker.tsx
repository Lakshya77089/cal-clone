"use client";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { addMonths, endOfMonth, endOfWeek, format, isSameDay, isSameMonth, startOfMonth, startOfWeek, subMonths } from "date-fns";
import { formatInTimeZone, toZonedTime } from "date-fns-tz";
import { toast } from "sonner";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useGetSlotsQuery } from "@/lib/api/calApi";
import { cn } from "@/lib/utils";
import type { PublicProfileDTO } from "@cal/shared";

type Props = {
  profile: PublicProfileDTO;
  viewerTimezone: string;
  onPickSlot?: (isoStartUtc: string) => Promise<void> | void;
};

function ymd(d: Date) {
  return format(d, "yyyy-MM-dd");
}

export function BookingPicker({
  profile,
  viewerTimezone,
  onPickSlot,
}: Props) {
  const router = useRouter();
  const [month, setMonth] = useState<Date>(() => new Date());
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [use24h, setUse24h] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const from = format(startOfMonth(month), "yyyy-MM-dd");
  const to = format(endOfMonth(addMonths(month, 1)), "yyyy-MM-dd");
  const { data, error, isFetching } = useGetSlotsQuery({
    eventTypeId: profile.eventType.id,
    from,
    to,
    timezone: viewerTimezone,
  });
  const slotsByDate = data?.slotsByDate ?? {};
  const loading = isFetching;

  useEffect(() => {
    if (error) toast.error("Failed to load times");
  }, [error]);

  const availableDates = useMemo(() => new Set(Object.keys(slotsByDate)), [slotsByDate]);

  // Auto-pick today (or the next available date) once slots load.
  useEffect(() => {
    if (selectedDate || availableDates.size === 0) return;
    const todayKey = format(new Date(), "yyyy-MM-dd");
    if (availableDates.has(todayKey)) {
      setSelectedDate(new Date());
      return;
    }
    const next = Array.from(availableDates).sort().find((k) => k >= todayKey);
    if (next) setSelectedDate(new Date(`${next}T12:00:00`));
  }, [availableDates, selectedDate]);

  const selectedDateKey = selectedDate ? format(selectedDate, "yyyy-MM-dd") : null;
  const slotsForDay = selectedDateKey ? slotsByDate[selectedDateKey] ?? [] : [];

  const today = useMemo(() => {
    const t = new Date();
    t.setHours(0, 0, 0, 0);
    return t;
  }, []);

  const monthStart = startOfMonth(month);
  const monthEnd = endOfMonth(month);
  const gridStart = startOfWeek(monthStart, { weekStartsOn: 0 });
  const gridEnd = endOfWeek(monthEnd, { weekStartsOn: 0 });
  const days: Date[] = [];
  for (let d = gridStart; d <= gridEnd; d = new Date(d.getTime() + 86400000)) {
    days.push(d);
  }

  const onSelectDate = (d: Date) => {
    setSelectedDate(d);
  };

  const onConfirm = async (iso: string) => {
    if (onPickSlot) {
      setSubmitting(true);
      try {
        await onPickSlot(iso);
      } finally {
        setSubmitting(false);
      }
      return;
    }
    router.push(
      `/${profile.user.username}/${profile.eventType.slug}/book?slot=${encodeURIComponent(iso)}&tz=${encodeURIComponent(viewerTimezone)}`,
    );
  };

  return (
    <>
      {/* Calendar column */}
      <div className="min-h-0 border-b border-border p-6 md:border-b-0 md:border-r">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-base font-semibold">{format(month, "MMMM yyyy")}</h2>
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => setMonth(subMonths(month, 1))}
              className="rounded-md p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground"
              aria-label="Previous month"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={() => setMonth(addMonths(month, 1))}
              className="rounded-md p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground"
              aria-label="Next month"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>

        <div className="grid grid-cols-7 gap-1.5 text-center">
          {["SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"].map((d) => (
            <div key={d} className="py-2 text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
              {d}
            </div>
          ))}
          {days.map((day) => {
            const inMonth = isSameMonth(day, month);
            const past = day < today;
            const isAvailable = availableDates.has(ymd(day));
            const disabled = past || !inMonth || !isAvailable;
            const selected = selectedDate ? isSameDay(day, selectedDate) : false;

            return (
              <button
                type="button"
                key={day.toISOString()}
                disabled={disabled}
                onClick={() => onSelectDate(day)}
                className={cn(
                  "relative aspect-square w-full rounded-md text-sm font-semibold transition-colors",
                  inMonth ? "text-foreground" : "text-muted-foreground/0",
                  !disabled && !selected && "bg-muted hover:bg-muted/70",
                  selected && "bg-foreground text-background hover:bg-foreground",
                  disabled && inMonth && "cursor-not-allowed text-muted-foreground/40",
                )}
                aria-label={format(day, "PPPP")}
              >
                {inMonth && format(day, "d")}
                {selected && (
                  <span className="absolute left-1 top-1 text-[9px] font-semibold uppercase">
                    {format(day, "d") === "1" ? format(day, "MMM") : ""}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Slots column */}
      <div className="flex h-full min-h-0 flex-col overflow-hidden p-6">
        <div className="mb-3 flex items-center justify-between">
          <p className="text-sm font-medium">
            {selectedDate ? (
              <>
                <span>{formatInTimeZone(selectedDate, viewerTimezone, "EEE")}</span>{" "}
                <span className="text-muted-foreground">
                  {formatInTimeZone(selectedDate, viewerTimezone, "d")}
                </span>
              </>
            ) : (
              "Pick a date"
            )}
          </p>
          <div className="inline-flex overflow-hidden rounded-md border border-border text-xs">
            <button
              type="button"
              onClick={() => setUse24h(false)}
              className={cn("px-2.5 py-1", !use24h ? "bg-background font-semibold text-foreground" : "text-muted-foreground")}
            >
              12h
            </button>
            <button
              type="button"
              onClick={() => setUse24h(true)}
              className={cn("px-2.5 py-1", use24h ? "bg-background font-semibold text-foreground" : "text-muted-foreground")}
            >
              24h
            </button>
          </div>
        </div>

        <div className="no-scrollbar -mx-1 flex-1 space-y-2 overflow-y-auto px-1">
          {loading ? (
            <p className="text-sm text-muted-foreground">Loading…</p>
          ) : !selectedDate ? (
            <p className="text-sm text-muted-foreground">Pick a date to see available times.</p>
          ) : slotsForDay.length === 0 ? (
            <p className="text-sm text-muted-foreground">No times available on this day.</p>
          ) : (
            slotsForDay.map((iso) => {
              const zoned = toZonedTime(new Date(iso), viewerTimezone);
              const label = format(zoned, use24h ? "HH:mm" : "h:mma").toLowerCase();
              return (
                <button
                  type="button"
                  key={iso}
                  onClick={() => onConfirm(iso)}
                  disabled={submitting}
                  className="flex w-full items-center justify-center gap-2 rounded-lg border border-border bg-background py-3 text-sm font-semibold transition-colors hover:border-foreground disabled:opacity-50"
                >
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                  {label}
                </button>
              );
            })
          )}
        </div>
      </div>
    </>
  );
}
