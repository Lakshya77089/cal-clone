import Link from "next/link";
import { notFound } from "next/navigation";
import { formatInTimeZone } from "date-fns-tz";
import { Calendar, CheckCircle2, Clock, Globe, User as UserIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { api, ApiError } from "@/lib/api";

export default async function BookingConfirmationPage({
  params,
}: {
  params: { id: string };
}) {
  let booking;
  try {
    booking = await api.bookings.get(params.id);
  } catch (err) {
    if (err instanceof ApiError && err.status === 404) notFound();
    throw err;
  }

  const isCancelled = booking.status === "CANCELLED";
  const tz = booking.attendeeTimezone;
  const start = new Date(booking.startTime);
  const end = new Date(booking.endTime);

  return (
    <main className="flex min-h-screen items-center justify-center bg-muted/40 p-4 sm:p-8">
      <div className="w-full max-w-md rounded-2xl border border-border bg-white p-8 shadow-sm">
        <div className="mb-4 flex justify-center">
          {isCancelled ? (
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-muted text-muted-foreground">
              ×
            </div>
          ) : (
            <CheckCircle2 className="h-12 w-12 text-foreground" />
          )}
        </div>
        <h1 className="text-center text-xl font-semibold">
          {isCancelled ? "This booking was cancelled" : "This meeting is scheduled"}
        </h1>
        <p className="mt-1 text-center text-sm text-muted-foreground">
          {isCancelled
            ? "It’s no longer on the calendar."
            : `We sent an email to ${booking.attendeeEmail} with the details.`}
        </p>

        <div className="my-6 divide-y divide-border rounded-lg border border-border text-sm">
          <Row icon={<Calendar className="h-4 w-4" />} label="What">
            {booking.eventType.title}
          </Row>
          <Row icon={<UserIcon className="h-4 w-4" />} label="Who">
            <div className="space-y-0.5">
              <p>
                {booking.eventType.user.name} <span className="text-muted-foreground">(host)</span>
              </p>
              <p>
                {booking.attendeeName}{" "}
                <span className="text-muted-foreground">({booking.attendeeEmail})</span>
              </p>
            </div>
          </Row>
          <Row icon={<Clock className="h-4 w-4" />} label="When">
            <div>
              <p>{formatInTimeZone(start, tz, "EEEE, MMMM d, yyyy")}</p>
              <p className="text-muted-foreground">
                {formatInTimeZone(start, tz, "h:mm a")} – {formatInTimeZone(end, tz, "h:mm a")}
              </p>
            </div>
          </Row>
          <Row icon={<Globe className="h-4 w-4" />} label="Timezone">
            {tz}
          </Row>
          {booking.attendeeNotes && (
            <Row icon={<></>} label="Notes">
              <span className="text-muted-foreground">{booking.attendeeNotes}</span>
            </Row>
          )}
        </div>

        {!isCancelled && (
          <div className="flex flex-wrap justify-center gap-2">
            <Button asChild variant="secondary" size="sm">
              <Link href={`/reschedule/${booking.id}`}>Reschedule</Link>
            </Button>
          </div>
        )}
      </div>
    </main>
  );
}

function Row({
  icon,
  label,
  children,
}: {
  icon: React.ReactNode;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex gap-3 px-4 py-3">
      <div className="flex w-20 shrink-0 items-center gap-2 text-muted-foreground">
        <span className="flex h-4 w-4 items-center justify-center">{icon}</span>
        <span className="text-xs uppercase tracking-wide">{label}</span>
      </div>
      <div className="flex-1">{children}</div>
    </div>
  );
}
