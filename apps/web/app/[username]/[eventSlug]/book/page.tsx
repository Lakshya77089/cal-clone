import { notFound, redirect } from "next/navigation";
import { EventInfo } from "@/components/booking/event-info";
import { BookingForm } from "@/components/booking/booking-form";
import { api, ApiError } from "@/lib/api";

export default async function BookPage({
  params,
  searchParams,
}: {
  params: { username: string; eventSlug: string };
  searchParams: { slot?: string; tz?: string };
}) {
  const slot = searchParams.slot;
  if (!slot) redirect(`/${params.username}/${params.eventSlug}`);

  let profile: Awaited<ReturnType<typeof api.publicProfile>>;
  try {
    profile = await api.publicProfile(params.username, params.eventSlug);
  } catch (err) {
    if (err instanceof ApiError && err.status === 404) notFound();
    throw err;
  }

  const viewerTimezone = searchParams.tz || profile.scheduleTimezone;

  return (
    <main className="flex min-h-screen items-center justify-center bg-muted/40 p-4 sm:p-8">
      <div className="grid w-full max-w-3xl grid-cols-1 overflow-hidden rounded-2xl border border-border bg-white shadow-sm md:grid-cols-[280px_1fr]">
        <EventInfo profile={profile} viewerTimezone={viewerTimezone} />
        <BookingForm
          profile={profile}
          startTime={slot}
          viewerTimezone={viewerTimezone}
        />
      </div>
    </main>
  );
}
