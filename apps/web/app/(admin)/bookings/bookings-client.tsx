"use client";

import { useSearchParams } from "next/navigation";
import { ChevronDown, ChevronLeft, ChevronRight, ListFilter, Menu, CalendarDays } from "lucide-react";
import { BookingList } from "@/components/admin/booking-list";
import { BookingListSkeleton } from "@/components/admin/list-skeleton";
import { useGetMeQuery, useListBookingsQuery } from "@/lib/api/calApi";
import { cn } from "@/lib/utils";

const SCOPES = [
  { key: "upcoming", label: "Upcoming" },
  { key: "unconfirmed", label: "Unconfirmed" },
  { key: "recurring", label: "Recurring" },
  { key: "past", label: "Past" },
  { key: "cancelled", label: "Canceled" },
] as const;
type Scope = (typeof SCOPES)[number]["key"];

export function BookingsClient() {
  const searchParams = useSearchParams();
  const raw = searchParams.get("scope") ?? "upcoming";
  const scope: Scope = (SCOPES.map((s) => s.key) as readonly string[]).includes(raw)
    ? (raw as Scope)
    : "upcoming";

  const isVisualOnly = scope === "unconfirmed" || scope === "recurring";

  const { data: me } = useGetMeQuery();
  const { data: fetched, error, isLoading } = useListBookingsQuery(
    scope as "upcoming" | "past" | "cancelled",
    { skip: isVisualOnly },
  );
  const bookings = isVisualOnly ? [] : fetched ?? null;
  const viewerTimezone = isVisualOnly ? "UTC" : me?.timezoneDefault ?? null;

  return (
    <div>
      {/* Top toolbar */}
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-1.5">
          {SCOPES.map((s) => (
            <a key={s.key} href={`?scope=${s.key}`}>
              <button
                type="button"
                className={cn(
                  "rounded-md px-3 py-1.5 text-sm font-semibold transition-colors",
                  scope === s.key
                    ? "bg-muted text-foreground"
                    : "text-muted-foreground hover:bg-muted/40 hover:text-foreground",
                )}
              >
                {s.label}
              </button>
            </a>
          ))}
          <button
            type="button"
            className="ml-1 inline-flex items-center gap-1.5 rounded-md border border-border px-3 py-1.5 text-sm font-medium text-foreground hover:bg-muted/40"
          >
            <ListFilter className="h-4 w-4" />
            Filter
            {scope === "past" && (
              <span className="inline-flex h-5 w-5 items-center justify-center rounded bg-foreground text-[11px] font-bold text-background">
                1
              </span>
            )}
          </button>
        </div>

        <div className="flex items-center gap-2">
          {scope !== "past" && (
            <button
              type="button"
              className="inline-flex items-center gap-1.5 rounded-md border border-border bg-card px-3 py-1.5 text-sm font-medium text-foreground hover:bg-muted/40"
            >
              <Menu className="h-4 w-4" />
              Saved filters
              <ChevronDown className="h-3.5 w-3.5" />
            </button>
          )}
          <div className="flex items-center gap-0.5 rounded-md border border-border bg-card p-1">
            <button
              type="button"
              className="rounded-sm p-1 text-muted-foreground hover:bg-muted/40 hover:text-foreground"
              aria-label="List view"
            >
              <Menu className="h-4 w-4" />
            </button>
            <button
              type="button"
              className="rounded-sm p-1 text-muted-foreground hover:bg-muted/40 hover:text-foreground"
              aria-label="Calendar view"
            >
              <CalendarDays className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Optional: Past tab shows a Date Range filter row */}
      {scope === "past" && (
        <div className="mb-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <button
              type="button"
              className="inline-flex items-center gap-1.5 rounded-md border border-border bg-card px-3 py-1.5 text-sm font-medium text-foreground hover:bg-muted/40"
            >
              <CalendarDays className="h-4 w-4" />
              Date Range
              <span className="rounded bg-muted px-1.5 py-0.5 text-xs">Last 7 Days</span>
              <ChevronDown className="h-3.5 w-3.5" />
            </button>
            <button
              type="button"
              className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-border bg-card text-foreground hover:bg-muted/40"
              aria-label="Add filter"
            >
              +
            </button>
          </div>
          <div className="flex items-center gap-2 text-sm">
            <button
              type="button"
              className="inline-flex items-center gap-1 text-muted-foreground hover:text-foreground"
            >
              × Clear
            </button>
            <button
              type="button"
              className="inline-flex items-center gap-1 rounded-md border border-border bg-card px-3 py-1.5 font-medium text-foreground hover:bg-muted/40"
            >
              Save
            </button>
          </div>
        </div>
      )}

      {error ? (
        <div className="rounded-lg border border-border bg-card p-8 text-sm text-muted-foreground">
          Couldn&rsquo;t load bookings. Is the API running?
        </div>
      ) : isLoading || bookings === null || viewerTimezone === null ? (
        <BookingListSkeleton />
      ) : (
        <BookingList
          bookings={bookings}
          scope={scope === "unconfirmed" || scope === "recurring" ? "upcoming" : scope}
          viewerTimezone={viewerTimezone}
          emptyLabel={
            scope === "unconfirmed"
              ? "unconfirmed"
              : scope === "recurring"
                ? "recurring"
                : undefined
          }
        />
      )}

      {/* Bottom pagination footer (visual; one page) */}
      {bookings && bookings.length > 0 && (
        <div className="mt-2 flex items-center justify-between border-t border-border px-2 py-3 text-sm text-muted-foreground">
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1.5 rounded-md border border-border bg-card px-2 py-1">
              10 <ChevronDown className="h-3 w-3" />
            </span>
            rows per page
          </div>
          <div className="flex items-center gap-2">
            <span>1-{bookings.length} of {bookings.length}</span>
            <button
              type="button"
              className="inline-flex h-7 w-7 items-center justify-center rounded-md border border-border text-muted-foreground"
              disabled
            >
              <ChevronLeft className="h-3.5 w-3.5" />
            </button>
            <button
              type="button"
              className="inline-flex h-7 w-7 items-center justify-center rounded-md border border-border text-muted-foreground"
              disabled
            >
              <ChevronRight className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
