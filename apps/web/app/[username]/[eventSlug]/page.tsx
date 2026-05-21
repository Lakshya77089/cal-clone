import { notFound } from "next/navigation";
import { EventInfo } from "@/components/booking/event-info";
import { BookingPicker } from "@/components/booking/booking-picker";
import { api, ApiError } from "@/lib/api";

export default async function PublicBookingPage({
  params,
  searchParams,
}: {
  params: { username: string; eventSlug: string };
  searchParams: { tz?: string };
}) {
  let profile: Awaited<ReturnType<typeof api.publicProfile>>;
  try {
    profile = await api.publicProfile(params.username, params.eventSlug);
  } catch (err) {
    if (err instanceof ApiError && err.status === 404) notFound();
    throw err;
  }

  // Default to the schedule's timezone server-side; client picks one up via `?tz=`.
  const viewerTimezone = searchParams.tz || profile.scheduleTimezone;

  return (
    <main className="flex min-h-screen items-center justify-center bg-muted/40 p-4 sm:p-8">
      <div className="grid w-full max-w-5xl grid-cols-1 overflow-hidden rounded-2xl border border-border bg-card shadow-sm md:grid-cols-[300px_1fr]">
        <EventInfo profile={profile} viewerTimezone={viewerTimezone} />
        <BookingPicker profile={profile} viewerTimezone={viewerTimezone} />
      </div>
    </main>
  );
}
