"use client";
import { useRouter } from "next/navigation";
import { EventInfo } from "@/components/booking/event-info";
import { BookingPicker } from "@/components/booking/booking-picker";
import type { PublicProfileDTO } from "@cal/shared";

export function RescheduleClient({
  profile,
  bookingId,
  viewerTimezone,
  formerStartTime,
}: {
  profile: PublicProfileDTO;
  bookingId: string;
  viewerTimezone: string;
  formerStartTime?: string;
}) {
  const router = useRouter();

  const onPick = (isoStart: string) => {
    router.push(
      `/reschedule/${bookingId}/form?slot=${encodeURIComponent(isoStart)}&tz=${encodeURIComponent(viewerTimezone)}`,
    );
  };

  return (
    <>
      <EventInfo
        profile={profile}
        viewerTimezone={viewerTimezone}
        formerStartTime={formerStartTime}
      />
      <BookingPicker
        profile={profile}
        viewerTimezone={viewerTimezone}
        onPickSlot={onPick}
      />
    </>
  );
}
