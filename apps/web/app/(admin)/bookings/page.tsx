import { Suspense } from "react";
import { BookingsClient } from "./bookings-client";

export default function BookingsPage() {
  return (
    <Suspense>
      <BookingsClient />
    </Suspense>
  );
}
