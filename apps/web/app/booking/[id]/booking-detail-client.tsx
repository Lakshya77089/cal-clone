"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { formatInTimeZone } from "date-fns-tz";
import { Check, ChevronLeft, ExternalLink, Flag, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useCancelBookingMutation } from "@/lib/api/calApi";
import type { BookingDTO, EventTypeDTO } from "@cal/shared";

type DetailBooking = BookingDTO & {
  eventType: EventTypeDTO & { user: { name: string; username: string } };
  guests?: string[];
  rescheduledFrom?: {
    id: string;
    startTime: string;
    endTime: string;
    attendeeEmail: string;
  } | null;
};

export function BookingDetailClient({ initial }: { initial: DetailBooking }) {
  const router = useRouter();
  const [booking, setBooking] = useState<DetailBooking>(initial);
  const [cancelOpen, setCancelOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [cancelBooking, cancelState] = useCancelBookingMutation();
  const pending = cancelState.isLoading;

  const isCancelled = booking.status === "CANCELLED";
  const tz = booking.attendeeTimezone;
  const start = new Date(booking.startTime);
  const end = new Date(booking.endTime);

  const tzLong = (() => {
    try {
      const formatter = new Intl.DateTimeFormat("en-US", {
        timeZone: tz,
        timeZoneName: "long",
      });
      const parts = formatter.formatToParts(start);
      return parts.find((p) => p.type === "timeZoneName")?.value ?? tz;
    } catch {
      return tz;
    }
  })();

  const hostName = booking.eventType.user.name;
  const guests = booking.guests ?? [];

  const onCancel = async () => {
    try {
      const updated = await cancelBooking({
        id: booking.id,
        body: { reason: reason.trim() || null },
      }).unwrap();
      toast.success("Booking cancelled");
      setBooking({ ...booking, ...updated, eventType: booking.eventType });
      setCancelOpen(false);
      router.refresh();
    } catch (err) {
      const e = err as { data?: { error?: string } };
      toast.error(e?.data?.error ?? "Failed to cancel");
    }
  };

  return (
    <main className="relative min-h-screen bg-background">
      <Link
        href="/bookings"
        className="absolute left-6 top-6 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ChevronLeft className="h-4 w-4" /> Back to bookings
      </Link>

      <div className="flex min-h-screen flex-col items-center justify-center px-4 py-16">
        <div className="w-full max-w-2xl overflow-hidden rounded-2xl border border-border bg-card">
          <div className="border-b border-border px-8 py-10 text-center">
            <div className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-full bg-muted">
              {isCancelled ? (
                <X className="h-6 w-6 text-muted-foreground" />
              ) : (
                <Check className="h-6 w-6 text-emerald-500" />
              )}
            </div>
            <h1 className="text-2xl font-bold tracking-tight">
              {isCancelled ? "This booking was cancelled" : "This meeting is scheduled"}
            </h1>
            <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">
              {isCancelled
                ? "It is no longer on the calendar."
                : "We sent an email with a calendar invitation with the details to everyone."}
            </p>
          </div>

          <div className="px-8 py-6">
            <dl className="grid grid-cols-[160px_1fr] gap-y-5 text-sm">
              {booking.rescheduleReason && (
                <>
                  <dt className="font-semibold">Reschedule reason</dt>
                  <dd>{booking.rescheduleReason}</dd>
                </>
              )}

              {booking.rescheduledFrom && (
                <>
                  <dt className="font-semibold">Rescheduled by</dt>
                  <dd>
                    <div>{booking.rescheduledFrom.attendeeEmail}</div>
                    <Link
                      href={`/booking/${booking.rescheduledFrom.id}`}
                      className="text-foreground underline-offset-2 hover:underline"
                    >
                      Original booking
                    </Link>
                  </dd>
                </>
              )}

              <dt className="font-semibold">What</dt>
              <dd>
                {booking.eventType.title} between {hostName} and {booking.attendeeName}
              </dd>

              <dt className="font-semibold">When</dt>
              <dd>
                {booking.rescheduledFrom && (
                  <div className="text-muted-foreground line-through">
                    <div>
                      {formatInTimeZone(
                        new Date(booking.rescheduledFrom.startTime),
                        tz,
                        "EEEE, MMMM d, yyyy",
                      )}
                    </div>
                    <div>
                      {formatInTimeZone(
                        new Date(booking.rescheduledFrom.startTime),
                        tz,
                        "h:mm a",
                      )}{" "}
                      -{" "}
                      {formatInTimeZone(
                        new Date(booking.rescheduledFrom.endTime),
                        tz,
                        "h:mm a",
                      )}{" "}
                      ({tzLong})
                    </div>
                  </div>
                )}
                <div className={booking.rescheduledFrom ? "mt-2" : ""}>
                  <div>{formatInTimeZone(start, tz, "EEEE, MMMM d, yyyy")}</div>
                  <div>
                    <span className="font-medium">
                      {formatInTimeZone(start, tz, "h:mm a")} -{" "}
                      {formatInTimeZone(end, tz, "h:mm a")}
                    </span>{" "}
                    <span className="text-muted-foreground">({tzLong})</span>
                  </div>
                </div>
              </dd>

              <dt className="font-semibold">Who</dt>
              <dd className="space-y-3">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-medium">{hostName}</span>
                    <span className="rounded bg-blue-500/15 px-1.5 py-0.5 text-[11px] font-medium text-blue-400">
                      Host
                    </span>
                  </div>
                  <div className="text-muted-foreground">{booking.attendeeEmail}</div>
                </div>
                <div>
                  <div className="font-medium">{booking.attendeeName}</div>
                  <div className="text-muted-foreground">{booking.attendeeEmail}</div>
                </div>
                {guests.map((g) => (
                  <div key={g}>
                    <div className="text-muted-foreground">{g}</div>
                  </div>
                ))}
              </dd>

              <dt className="font-semibold">Where</dt>
              <dd>
                <a href="#" className="inline-flex items-center gap-1 hover:underline">
                  Cal Video <ExternalLink className="h-3.5 w-3.5" />
                </a>
              </dd>

              {booking.attendeeNotes && (
                <>
                  <dt className="font-semibold">Additional notes</dt>
                  <dd>{booking.attendeeNotes}</dd>
                </>
              )}
            </dl>
          </div>

          {!isCancelled && !cancelOpen && (
            <div className="flex items-center justify-center gap-4 border-t border-border px-8 py-5">
              <span className="text-sm font-medium">Add to calendar</span>
              <div className="flex items-center gap-2">
                <CalendarLinkButton label="G" href={googleCalUrl(booking)} />
                <CalendarLinkButton label="O" href={outlookCalUrl(booking)} />
                <CalendarLinkButton label="365" href={office365CalUrl(booking)} />
                <CalendarLinkButton label="ICS" href="#" />
              </div>
            </div>
          )}

          {!isCancelled && cancelOpen && (
            <div className="border-t border-border px-8 py-6">
              <label
                htmlFor="cancel-reason"
                className="block text-sm font-semibold"
              >
                Reason for cancellation
              </label>
              <Textarea
                id="cancel-reason"
                rows={3}
                placeholder="Why are you cancelling?"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                className="mt-2 resize-none bg-background"
              />
              <p className="mt-2 text-xs text-muted-foreground">
                Cancellation reason will be shared with guests
              </p>
              <div className="mt-4 flex justify-end gap-2">
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => {
                    setCancelOpen(false);
                    setReason("");
                  }}
                  disabled={pending}
                >
                  Nevermind
                </Button>
                <Button
                  type="button"
                  variant="secondary"
                  onClick={onCancel}
                  disabled={pending}
                >
                  {pending ? "Cancelling…" : "Cancel event"}
                </Button>
              </div>
            </div>
          )}
        </div>

        {!isCancelled && !cancelOpen && (
          <div className="mt-6 text-center text-sm text-muted-foreground">
            Need to make a change?{" "}
            <Link
              href={`/reschedule/${booking.id}`}
              className="text-foreground underline-offset-2 hover:underline"
            >
              Reschedule
            </Link>{" "}
            or{" "}
            <button
              type="button"
              onClick={() => setCancelOpen(true)}
              className="text-foreground underline-offset-2 hover:underline"
            >
              Cancel
            </button>
          </div>
        )}

        <button
          type="button"
          className="mt-12 inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
        >
          <Flag className="h-3.5 w-3.5" />
          Report booking
        </button>
      </div>
    </main>
  );
}

function CalendarLinkButton({ label, href }: { label: string; href: string }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="flex h-9 min-w-9 items-center justify-center rounded-md border border-border bg-card px-2 text-xs font-bold text-foreground hover:bg-muted/40"
    >
      {label}
    </a>
  );
}

type BookingForCal = {
  eventType: { title: string };
  startTime: string;
  endTime: string;
  attendeeNotes: string | null;
};

function googleCalUrl(b: BookingForCal): string {
  const f = (d: string) => new Date(d).toISOString().replace(/[-:]|\.\d{3}/g, "");
  const params = new URLSearchParams({
    action: "TEMPLATE",
    text: b.eventType.title,
    dates: `${f(b.startTime)}/${f(b.endTime)}`,
    details: b.attendeeNotes ?? "",
  });
  return `https://calendar.google.com/calendar/render?${params.toString()}`;
}

function outlookCalUrl(b: BookingForCal): string {
  const params = new URLSearchParams({
    path: "/calendar/action/compose",
    rru: "addevent",
    subject: b.eventType.title,
    startdt: b.startTime,
    enddt: b.endTime,
    body: b.attendeeNotes ?? "",
  });
  return `https://outlook.live.com/calendar/0/deeplink/compose?${params.toString()}`;
}

function office365CalUrl(b: BookingForCal): string {
  const params = new URLSearchParams({
    path: "/calendar/action/compose",
    rru: "addevent",
    subject: b.eventType.title,
    startdt: b.startTime,
    enddt: b.endTime,
    body: b.attendeeNotes ?? "",
  });
  return `https://outlook.office.com/calendar/0/deeplink/compose?${params.toString()}`;
}
