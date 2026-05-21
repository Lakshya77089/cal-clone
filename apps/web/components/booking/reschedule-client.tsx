"use client";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { EventInfo } from "@/components/booking/event-info";
import { BookingPicker } from "@/components/booking/booking-picker";
import { api, ApiError } from "@/lib/api";
import type { PublicProfileDTO } from "@cal/shared";

export function RescheduleClient({
  profile,
  bookingId,
  viewerTimezone,
}: {
  profile: PublicProfileDTO;
  bookingId: string;
  viewerTimezone: string;
}) {
  const router = useRouter();

  const onPick = async (isoStart: string) => {
    try {
      const created = await api.bookings.reschedule(bookingId, { startTime: isoStart });
      toast.success("Rescheduled");
      router.push(`/booking/${created.id}`);
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Failed to reschedule");
    }
  };

  return (
    <>
      <EventInfo profile={profile} viewerTimezone={viewerTimezone} />
      <BookingPicker
        profile={profile}
        viewerTimezone={viewerTimezone}
        onPickSlot={onPick}
        pickButtonLabel="Reschedule to this time"
      />
    </>
  );
}
