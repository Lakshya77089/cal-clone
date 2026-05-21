"use client";
import * as React from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import {
  addMonths,
  endOfMonth,
  endOfWeek,
  format,
  isSameDay,
  isSameMonth,
  startOfMonth,
  startOfWeek,
  subMonths,
} from "date-fns";
import { cn } from "@/lib/utils";

type CalendarProps = {
  /** Currently selected date, or null if none. */
  selectedDate: Date | null;
  /** Called when the user picks a date. */
  onSelect: (d: Date) => void;
  /** Days that have at least one available slot — shown with a small indicator. */
  availableDates?: Set<string>; // YYYY-MM-DD
  /** Disable dates before today. */
  disablePast?: boolean;
  /** Initial month to display. */
  initialMonth?: Date;
};

function ymd(d: Date) {
  return format(d, "yyyy-MM-dd");
}

export function Calendar({
  selectedDate,
  onSelect,
  availableDates,
  disablePast = true,
  initialMonth,
}: CalendarProps) {
  const [month, setMonth] = React.useState<Date>(() => initialMonth ?? new Date());
  const today = React.useMemo(() => {
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

  return (
    <div className="w-full select-none">
      <div className="mb-4 flex items-center justify-between">
        <h3 className="text-sm font-semibold">{format(month, "MMMM yyyy")}</h3>
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

      <div className="grid grid-cols-7 gap-1 text-center">
        {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((d) => (
          <div key={d} className="text-xs font-medium text-muted-foreground py-1">
            {d}
          </div>
        ))}
        {days.map((day) => {
          const inMonth = isSameMonth(day, month);
          const past = disablePast && day < today;
          const isAvailable = availableDates ? availableDates.has(ymd(day)) : true;
          const disabled = past || !inMonth || !isAvailable;
          const selected = selectedDate ? isSameDay(day, selectedDate) : false;
          const isToday = isSameDay(day, today);

          return (
            <button
              type="button"
              key={day.toISOString()}
              disabled={disabled}
              onClick={() => onSelect(day)}
              className={cn(
                "relative aspect-square w-full rounded-md text-sm font-medium transition-colors",
                inMonth ? "text-foreground" : "text-muted-foreground/40",
                !disabled &&
                  !selected &&
                  "hover:bg-muted",
                selected && "bg-primary text-primary-foreground hover:bg-primary",
                disabled && "cursor-not-allowed text-muted-foreground/30",
                isToday && !selected && "ring-1 ring-border",
              )}
              aria-label={format(day, "PPPP")}
            >
              {format(day, "d")}
              {inMonth && !selected && isAvailable && !past && (
                <span className="absolute bottom-1 left-1/2 h-1 w-1 -translate-x-1/2 rounded-full bg-foreground/70" />
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
