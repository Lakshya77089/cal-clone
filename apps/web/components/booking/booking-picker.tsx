"use client";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { addMonths, endOfMonth, format, startOfMonth } from "date-fns";
import { formatInTimeZone, toZonedTime } from "date-fns-tz";
import { toast } from "sonner";
import { Calendar } from "@/components/ui/calendar";
import { Button } from "@/components/ui/button";
import { api, ApiError } from "@/lib/api";
import { cn } from "@/lib/utils";
import type { PublicProfileDTO } from "@cal/shared";

type Props = {
  profile: PublicProfileDTO;
  viewerTimezone: string;
  /** When set, a slot pick goes through this callback instead of routing to /book. */
  onPickSlot?: (isoStartUtc: string) => Promise<void> | void;
  pickButtonLabel?: string;
};

export function BookingPicker({
  profile,
  viewerTimezone,
  onPickSlot,
  pickButtonLabel = "Confirm",
}: Props) {
  const router = useRouter();
  const [month, setMonth] = useState<Date>(() => new Date());
  const [slotsByDate, setSlotsByDate] = useState<Record<string, string[]>>({});
  const [loading, setLoading] = useState(true);
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [selectedSlot, setSelectedSlot] = useState<string | null>(null);
  const [use24h, setUse24h] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Fetch slots for the visible month + a small buffer either side.
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    const from = format(startOfMonth(month), "yyyy-MM-dd");
    const to = format(endOfMonth(addMonths(month, 1)), "yyyy-MM-dd");
    api
      .slots({
        eventTypeId: profile.eventType.id,
        from,
        to,
        timezone: viewerTimezone,
      })
      .then((data) => {
        if (!cancelled) setSlotsByDate(data.slotsByDate);
      })
      .catch((err) => {
        if (!cancelled) toast.error(err instanceof ApiError ? err.message : "Failed to load times");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [profile.eventType.id, viewerTimezone, month.getFullYear(), month.getMonth()]);

  const availableDates = useMemo(() => new Set(Object.keys(slotsByDate)), [slotsByDate]);

  const selectedDateKey = selectedDate ? format(selectedDate, "yyyy-MM-dd") : null;
  const slotsForDay = selectedDateKey ? slotsByDate[selectedDateKey] ?? [] : [];

  const onSelectDate = (d: Date) => {
    setSelectedDate(d);
    setSelectedSlot(null);
  };

  const onConfirm = async () => {
    if (!selectedSlot) return;
    if (onPickSlot) {
      setSubmitting(true);
      try {
        await onPickSlot(selectedSlot);
      } finally {
        setSubmitting(false);
      }
      return;
    }
    // Default: forward to the book page with the slot in the query string.
    router.push(
      `/${profile.user.username}/${profile.eventType.slug}/book?slot=${encodeURIComponent(selectedSlot)}&tz=${encodeURIComponent(viewerTimezone)}`,
    );
  };

  return (
    <div className="grid flex-1 grid-cols-1 md:grid-cols-[1fr_320px]">
      <div className="border-b border-border p-6 md:border-b-0 md:border-r">
        <Calendar
          selectedDate={selectedDate}
          onSelect={onSelectDate}
          availableDates={availableDates}
          initialMonth={month}
        />
        <p className="mt-4 text-xs text-muted-foreground">
          {loading ? "Loading availability…" : `Times shown in ${viewerTimezone}`}
        </p>
      </div>

      <div className="flex h-full min-h-[480px] flex-col p-6">
        <div className="mb-3 flex items-center justify-between">
          <p className="text-sm font-medium">
            {selectedDate
              ? formatInTimeZone(selectedDate, viewerTimezone, "EEE, MMM d")
              : "Pick a date"}
          </p>
          <div className="inline-flex overflow-hidden rounded-md border border-border text-xs">
            <button
              type="button"
              onClick={() => setUse24h(false)}
              className={cn("px-2 py-1", !use24h ? "bg-muted font-medium" : "text-muted-foreground")}
            >
              12h
            </button>
            <button
              type="button"
              onClick={() => setUse24h(true)}
              className={cn("px-2 py-1", use24h ? "bg-muted font-medium" : "text-muted-foreground")}
            >
              24h
            </button>
          </div>
        </div>

        <div className="-mx-2 flex-1 space-y-2 overflow-y-auto px-2">
          {!selectedDate ? (
            <p className="text-sm text-muted-foreground">Pick a date to see available times.</p>
          ) : slotsForDay.length === 0 ? (
            <p className="text-sm text-muted-foreground">No times available on this day.</p>
          ) : (
            slotsForDay.map((iso) => {
              const isSelected = selectedSlot === iso;
              const zoned = toZonedTime(new Date(iso), viewerTimezone);
              const label = format(zoned, use24h ? "HH:mm" : "h:mm a");
              if (isSelected) {
                return (
                  <div key={iso} className="flex gap-2">
                    <div className="flex-1 rounded-md border border-foreground bg-white py-2 text-center text-sm font-medium text-foreground">
                      {label}
                    </div>
                    <Button
                      type="button"
                      className="flex-1"
                      onClick={onConfirm}
                      disabled={submitting}
                    >
                      {submitting ? "Working…" : pickButtonLabel}
                    </Button>
                  </div>
                );
              }
              return (
                <button
                  type="button"
                  key={iso}
                  onClick={() => setSelectedSlot(iso)}
                  className="block w-full rounded-md border border-border bg-white py-2 text-center text-sm font-medium text-foreground transition-colors hover:border-foreground"
                >
                  {label}
                </button>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
