import { notFound } from "next/navigation";
import { api, ApiError } from "@/lib/api";
import { BookingDetailClient } from "./booking-detail-client";

export default async function BookingConfirmationPage({
  params,
}: {
  params: { id: string };
}) {
  try {
    const booking = await api.bookings.get(params.id);
    return <BookingDetailClient initial={booking} />;
  } catch (err) {
    if (err instanceof ApiError && err.status === 404) notFound();
    throw err;
  }
}
