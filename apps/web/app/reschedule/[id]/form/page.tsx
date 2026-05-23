import { notFound, redirect } from "next/navigation";
import { Calendar, Columns3, LayoutGrid } from "lucide-react";
import { EventInfo } from "@/components/booking/event-info";
import { RescheduleForm } from "@/components/booking/reschedule-form";
import { api, ApiError } from "@/lib/api";

export default async function RescheduleFormPage({
  params,
  searchParams,
}: {
  params: { id: string };
  searchParams: { slot?: string; tz?: string };
}) {
  const slot = searchParams.slot;
  if (!slot) redirect(`/reschedule/${params.id}`);

  let booking;
  try {
    booking = await api.bookings.get(params.id);
  } catch (err) {
    if (err instanceof ApiError && err.status === 404) notFound();
    throw err;
  }

  const profile = await api.publicProfile(
    booking.eventType.user.username,
    booking.eventType.slug,
  );

  const viewerTimezone = searchParams.tz || booking.attendeeTimezone;

  return (
    <main className="relative min-h-screen bg-background">
      <div className="absolute right-6 top-6 flex items-center gap-2">
        <button
          type="button"
          className="rounded-md border border-border bg-card px-3 py-1.5 text-sm font-medium text-foreground hover:bg-muted/40"
        >
          Need help?
        </button>
        <div className="flex items-center gap-0.5 rounded-md border border-border bg-card p-1">
          <button type="button" className="rounded-sm p-1 text-muted-foreground hover:bg-muted/40" aria-label="Month view">
            <Calendar className="h-4 w-4" />
          </button>
          <button type="button" className="rounded-sm p-1 text-muted-foreground hover:bg-muted/40" aria-label="Weekly view">
            <LayoutGrid className="h-4 w-4" />
          </button>
          <button type="button" className="rounded-sm p-1 text-muted-foreground hover:bg-muted/40" aria-label="Column view">
            <Columns3 className="h-4 w-4" />
          </button>
        </div>
      </div>

      <div className="flex min-h-screen flex-col items-center justify-center px-4 py-12">
        <div className="grid w-full max-w-4xl grid-cols-1 overflow-hidden rounded-2xl border border-border bg-card md:grid-cols-[260px_1fr]">
          <EventInfo
            profile={profile}
            viewerTimezone={viewerTimezone}
            startTime={slot}
            formerStartTime={booking.startTime}
          />
          <RescheduleForm
            bookingId={booking.id}
            startTime={slot}
            viewerTimezone={viewerTimezone}
            defaultName={booking.attendeeName}
            defaultEmail={booking.attendeeEmail}
          />
        </div>
        <p className="mt-6 text-sm text-muted-foreground">Cal.com</p>
      </div>
    </main>
  );
}
