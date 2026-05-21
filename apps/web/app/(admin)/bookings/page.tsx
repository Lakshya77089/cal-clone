import { PageHeader } from "@/components/admin/page-header";
import { BookingList } from "@/components/admin/booking-list";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { api } from "@/lib/api";

export default async function BookingsPage({
  searchParams,
}: {
  searchParams: { scope?: string };
}) {
  const scope = (["upcoming", "past", "cancelled"].includes(searchParams.scope ?? "")
    ? searchParams.scope
    : "upcoming") as "upcoming" | "past" | "cancelled";

  let me: { timezoneDefault: string };
  let bookings: Awaited<ReturnType<typeof api.bookings.list>>;
  try {
    me = await api.me();
    bookings = await api.bookings.list(scope);
  } catch {
    return (
      <div>
        <PageHeader title="Bookings" />
        <div className="rounded-lg border border-border bg-card p-8 text-sm text-muted-foreground">
          Couldn&rsquo;t load bookings. Is the API running?
        </div>
      </div>
    );
  }

  return (
    <div>
      <PageHeader
        title="Bookings"
        description="See upcoming and past events with the people who booked time with you."
      />

      <Tabs value={scope}>
        <TabsList>
          <a href="?scope=upcoming">
            <TabsTrigger value="upcoming">Upcoming</TabsTrigger>
          </a>
          <a href="?scope=past">
            <TabsTrigger value="past">Past</TabsTrigger>
          </a>
          <a href="?scope=cancelled">
            <TabsTrigger value="cancelled">Cancelled</TabsTrigger>
          </a>
        </TabsList>
        <TabsContent value={scope}>
          <BookingList
            bookings={bookings}
            scope={scope}
            viewerTimezone={me.timezoneDefault}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}
