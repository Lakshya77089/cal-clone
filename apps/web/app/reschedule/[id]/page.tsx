import { notFound } from "next/navigation";
import { RescheduleClient } from "@/components/booking/reschedule-client";
import { api, ApiError } from "@/lib/api";

export default async function ReschedulePage({
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

  const profile = await api.publicProfile(
    booking.eventType.user.username,
    booking.eventType.slug,
  );

  return (
    <main className="flex min-h-screen items-center justify-center bg-muted/40 p-4 sm:p-8">
      <div className="w-full max-w-5xl">
        <div className="mb-4 rounded-lg border border-border bg-white p-4 text-sm">
          <p className="font-medium">Rescheduling: {booking.eventType.title}</p>
          <p className="text-muted-foreground">
            Originally scheduled with {booking.attendeeName} ({booking.attendeeEmail}). Pick a new time below.
          </p>
        </div>
        <div className="grid w-full grid-cols-1 overflow-hidden rounded-2xl border border-border bg-white shadow-sm md:grid-cols-[300px_1fr]">
          <RescheduleClient profile={profile} bookingId={booking.id} viewerTimezone={booking.attendeeTimezone} />
        </div>
      </div>
    </main>
  );
}
