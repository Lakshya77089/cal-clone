import { notFound } from "next/navigation";
import { Calendar, Columns3, LayoutGrid } from "lucide-react";
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

  const viewerTimezone = searchParams.tz || profile.scheduleTimezone;

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
          <button
            type="button"
            className="rounded-sm p-1 text-muted-foreground hover:bg-muted/40"
            aria-label="Month view"
          >
            <Calendar className="h-4 w-4" />
          </button>
          <button
            type="button"
            className="rounded-sm p-1 text-muted-foreground hover:bg-muted/40"
            aria-label="Weekly view"
          >
            <LayoutGrid className="h-4 w-4" />
          </button>
          <button
            type="button"
            className="rounded-sm p-1 text-muted-foreground hover:bg-muted/40"
            aria-label="Column view"
          >
            <Columns3 className="h-4 w-4" />
          </button>
        </div>
      </div>

      <div className="flex min-h-screen flex-col items-center justify-center px-4 py-12">
        <div className="grid h-[520px] w-full max-w-5xl grid-cols-1 overflow-hidden rounded-2xl border border-border bg-card md:grid-cols-[240px_1fr_260px]">
          <EventInfo profile={profile} viewerTimezone={viewerTimezone} />
          <BookingPicker profile={profile} viewerTimezone={viewerTimezone} />
        </div>
        <p className="mt-6 text-sm text-muted-foreground">Cal.com</p>
      </div>
    </main>
  );
}
