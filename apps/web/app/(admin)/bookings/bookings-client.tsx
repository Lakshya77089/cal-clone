"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { PageHeader } from "@/components/admin/page-header";
import { BookingList } from "@/components/admin/booking-list";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { api, ApiError } from "@/lib/api";
import type { BookingDTO } from "@cal/shared";

const SCOPES = ["upcoming", "past", "cancelled"] as const;
type Scope = (typeof SCOPES)[number];

export function BookingsClient() {
  const searchParams = useSearchParams();
  const raw = searchParams.get("scope") ?? "upcoming";
  const scope: Scope = (SCOPES as readonly string[]).includes(raw) ? (raw as Scope) : "upcoming";

  const [bookings, setBookings] = useState<BookingDTO[] | null>(null);
  const [viewerTimezone, setViewerTimezone] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setBookings(null);
    setError(null);
    (async () => {
      try {
        const [me, list] = await Promise.all([api.me(), api.bookings.list(scope)]);
        if (cancelled) return;
        setViewerTimezone(me.timezoneDefault);
        setBookings(list);
      } catch (err) {
        if (cancelled) return;
        setError(err instanceof ApiError ? err.message : "Couldn't load bookings");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [scope]);

  if (error) {
    return (
      <div>
        <PageHeader title="Bookings" />
        <div className="rounded-lg border border-border bg-card p-8 text-sm text-muted-foreground">
          {error}. Is the API running?
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
          {bookings === null || viewerTimezone === null ? (
            <div className="rounded-lg border border-border bg-card p-12 text-center text-sm text-muted-foreground">
              Loading…
            </div>
          ) : (
            <BookingList bookings={bookings} scope={scope} viewerTimezone={viewerTimezone} />
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
