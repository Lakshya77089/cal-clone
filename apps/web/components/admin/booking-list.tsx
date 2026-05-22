"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { formatInTimeZone } from "date-fns-tz";
import { Calendar, CalendarRange, Clock, Mail, User as UserIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { api, ApiError } from "@/lib/api";
import type { BookingDTO } from "@cal/shared";

type Scope = "upcoming" | "past" | "cancelled";

export function BookingList({
  bookings: initial,
  scope,
  viewerTimezone,
}: {
  bookings: BookingDTO[];
  scope: Scope;
  viewerTimezone: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [bookings, setBookings] = useState(initial);
  const [cancelTarget, setCancelTarget] = useState<BookingDTO | null>(null);
  const [reason, setReason] = useState("");

  const onCancel = () => {
    if (!cancelTarget) return;
    const id = cancelTarget.id;
    startTransition(async () => {
      try {
        await api.bookings.cancel(id, { reason: reason.trim() || null });
        toast.success("Booking cancelled");
        setBookings((prev) => prev.filter((b) => b.id !== id));
        setCancelTarget(null);
        setReason("");
        router.refresh();
      } catch (err) {
        toast.error(err instanceof ApiError ? err.message : "Failed to cancel");
      }
    });
  };

  if (bookings.length === 0) {
    const label = scope === "upcoming" ? "upcoming" : scope === "past" ? "past" : "cancelled";
    return (
      <div className="flex flex-col items-center justify-center rounded-lg border border-border bg-card px-6 py-16 text-center">
        <div className="mb-5 flex h-14 w-14 items-center justify-center rounded-full bg-muted">
          <CalendarRange className="h-6 w-6 text-muted-foreground" />
        </div>
        <h3 className="text-base font-semibold">No {label} bookings</h3>
        <p className="mt-2 max-w-sm text-sm text-muted-foreground">
          You have no {label} bookings. Your {label} bookings will show up here.
        </p>
      </div>
    );
  }

  // Group by date heading in viewer's timezone.
  const groups = new Map<string, BookingDTO[]>();
  for (const b of bookings) {
    const day = formatInTimeZone(new Date(b.startTime), viewerTimezone, "yyyy-MM-dd");
    const arr = groups.get(day) ?? [];
    arr.push(b);
    groups.set(day, arr);
  }
  const sortedKeys = Array.from(groups.keys()).sort((a, b) =>
    scope === "past" || scope === "cancelled" ? b.localeCompare(a) : a.localeCompare(b),
  );

  return (
    <div className="space-y-6">
      {sortedKeys.map((day) => {
        const items = groups.get(day) ?? [];
        return (
          <div key={day}>
            <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              {formatInTimeZone(new Date(`${day}T12:00:00Z`), viewerTimezone, "EEEE, MMMM d")}
            </h2>
            <div className="overflow-hidden rounded-lg border border-border bg-card">
              {items.map((b) => (
                <div
                  key={b.id}
                  className="flex flex-wrap items-start gap-4 border-b border-border px-6 py-4 last:border-0"
                >
                  <div className="w-32 shrink-0">
                    <p className="text-sm font-medium">
                      {formatInTimeZone(new Date(b.startTime), viewerTimezone, "h:mm a")}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {formatInTimeZone(new Date(b.endTime), viewerTimezone, "h:mm a")}
                    </p>
                  </div>

                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold">
                      {b.eventType?.title ?? "Event"}
                    </p>
                    <div className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
                      <span className="inline-flex items-center gap-1">
                        <UserIcon className="h-3 w-3" />
                        {b.attendeeName}
                      </span>
                      <span className="inline-flex items-center gap-1">
                        <Mail className="h-3 w-3" />
                        {b.attendeeEmail}
                      </span>
                      <span className="inline-flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        {b.attendeeTimezone}
                      </span>
                      {b.status !== "CONFIRMED" && (
                        <span className="inline-flex items-center gap-1 rounded bg-muted px-1.5 py-0.5">
                          {b.status === "CANCELLED" ? "Cancelled" : "Rescheduled"}
                        </span>
                      )}
                    </div>
                    {b.attendeeNotes && (
                      <p className="mt-1 text-xs italic text-muted-foreground">
                        &ldquo;{b.attendeeNotes}&rdquo;
                      </p>
                    )}
                  </div>

                  {scope === "upcoming" && (
                    <div className="flex shrink-0 gap-2">
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={() => router.push(`/reschedule/${b.id}`)}
                      >
                        <Calendar className="mr-1 h-3.5 w-3.5" />
                        Reschedule
                      </Button>
                      <Button variant="outline" size="sm" onClick={() => setCancelTarget(b)}>
                        Cancel
                      </Button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        );
      })}

      <Dialog open={!!cancelTarget} onOpenChange={(o) => !o && setCancelTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Cancel booking?</DialogTitle>
            <DialogDescription>
              {cancelTarget && (
                <>
                  This cancels{" "}
                  <strong>{cancelTarget.eventType?.title ?? "the event"}</strong> with{" "}
                  <strong>{cancelTarget.attendeeName}</strong>.
                </>
              )}
            </DialogDescription>
          </DialogHeader>
          <Textarea
            placeholder="Reason (optional, shown to attendee)"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
          />
          <DialogFooter>
            <Button variant="secondary" onClick={() => setCancelTarget(null)} disabled={pending}>
              Keep booking
            </Button>
            <Button variant="destructive" onClick={onCancel} disabled={pending}>
              {pending ? "Cancelling…" : "Cancel booking"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
