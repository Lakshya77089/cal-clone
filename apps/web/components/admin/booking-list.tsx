"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { formatInTimeZone } from "date-fns-tz";
import { CalendarRange, Flag, MoreVertical, Send, Video } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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
import { useCancelBookingMutation } from "@/lib/api/calApi";
import { cn } from "@/lib/utils";
import type { BookingDTO } from "@cal/shared";

type Scope = "upcoming" | "past" | "cancelled";

export function BookingList({
  bookings: initial,
  scope,
  viewerTimezone,
  emptyLabel,
}: {
  bookings: BookingDTO[];
  scope: Scope;
  viewerTimezone: string;
  /** Override the empty-state copy ("upcoming"/"past"/"cancelled" by default). */
  emptyLabel?: string;
}) {
  const router = useRouter();
  const [cancelBooking, cancelState] = useCancelBookingMutation();
  const pending = cancelState.isLoading;
  const bookings = initial;
  const [cancelTarget, setCancelTarget] = useState<BookingDTO | null>(null);
  const [reason, setReason] = useState("");

  const onCancel = async () => {
    if (!cancelTarget) return;
    try {
      await cancelBooking({
        id: cancelTarget.id,
        body: { reason: reason.trim() || null },
      }).unwrap();
      toast.success("Booking cancelled");
      setCancelTarget(null);
      setReason("");
      router.refresh();
    } catch (err) {
      const e = err as { data?: { error?: string } };
      toast.error(e?.data?.error ?? "Failed to cancel");
    }
  };

  if (bookings.length === 0) {
    const label = emptyLabel ?? scope;
    return (
      <div className="flex flex-col items-center justify-center rounded-2xl border border-border bg-card px-6 py-16 text-center">
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

  const isCancelledScope = scope === "cancelled";

  return (
    <>
      <div className="overflow-hidden rounded-2xl border border-border bg-card">
        {scope === "upcoming" && (
          <div className="border-b border-border px-6 py-3 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
            Next
          </div>
        )}

        {bookings.map((b, idx) => {
          const start = new Date(b.startTime);
          const end = new Date(b.endTime);
          const dateLine = formatInTimeZone(start, viewerTimezone, "EEE, d MMM");
          const timeRange = `${formatInTimeZone(start, viewerTimezone, "h:mma").toLowerCase()} - ${formatInTimeZone(end, viewerTimezone, "h:mma").toLowerCase()}`;
          const title = b.eventType?.title ?? "Event";
          const titleLine = `${title} between ${b.attendeeName} and lakshya sharma`;
          const showRescheduled = b.wasRescheduled === true;
          const showRescheduleRequestSent = false;

          return (
            <div
              key={b.id}
              className={cn(
                "flex flex-wrap items-start gap-4 px-6 py-5",
                idx > 0 && "border-t border-border",
              )}
            >
              {/* Left column: date + time + Join link + status pill */}
              <div className="w-44 shrink-0 space-y-1">
                <p className="text-sm font-semibold">{dateLine}</p>
                <p className="text-sm text-muted-foreground">{timeRange}</p>
                <a
                  href="#"
                  className="inline-flex items-center gap-1.5 text-sm font-medium text-blue-400 hover:underline"
                >
                  <Video className="h-3.5 w-3.5" />
                  Join Cal Video
                </a>
                {showRescheduled && (
                  <div className="pt-1">
                    <span className="inline-block rounded-md bg-amber-600/30 px-2 py-0.5 text-xs font-medium text-amber-400">
                      Rescheduled
                    </span>
                  </div>
                )}
              </div>

              {/* Middle column: title + notes + attendees */}
              <div className="min-w-0 flex-1 space-y-1">
                <p
                  className={cn(
                    "text-sm font-semibold",
                    b.status === "CANCELLED" && "text-muted-foreground line-through",
                  )}
                >
                  {titleLine}
                </p>
                {b.attendeeNotes && (
                  <p className="text-sm text-muted-foreground">
                    &ldquo;{b.attendeeNotes}&rdquo;
                  </p>
                )}
                <p className="text-sm">
                  You and {b.attendeeName}
                </p>
              </div>

              {/* Right column: pills + flag + menu */}
              <div className="flex shrink-0 items-center gap-2">
                {showRescheduleRequestSent && (
                  <span className="inline-flex items-center gap-1.5 rounded-md border border-border bg-muted px-2 py-1 text-xs font-medium text-foreground">
                    <Send className="h-3 w-3" />
                    Reschedule request sent
                  </span>
                )}
                {isCancelledScope && (
                  <button
                    type="button"
                    className="rounded-md border border-border p-1.5 text-muted-foreground hover:bg-muted/40 hover:text-foreground"
                    aria-label="Report"
                  >
                    <Flag className="h-3.5 w-3.5" />
                  </button>
                )}
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 rounded-md border border-border"
                      aria-label="More"
                    >
                      <MoreVertical className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem
                      onSelect={() => router.push(`/booking/${b.id}`)}
                    >
                      View details
                    </DropdownMenuItem>
                    {scope === "upcoming" && (
                      <>
                        <DropdownMenuItem
                          onSelect={() => router.push(`/reschedule/${b.id}`)}
                        >
                          Reschedule
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                          onSelect={() => setCancelTarget(b)}
                          className="text-destructive focus:text-destructive"
                        >
                          Cancel
                        </DropdownMenuItem>
                      </>
                    )}
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </div>
          );
        })}
      </div>

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
    </>
  );
}
