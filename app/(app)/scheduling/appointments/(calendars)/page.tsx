import { Suspense } from "react";

import { BookingScreen } from "@/components/appointments-booking/booking-screen";

// /scheduling/appointments: the availability-first booking screen. Suspense: it reads the URL
// (useSearchParams) for its state.
export default function AppointmentsPage() {
  return (
    <Suspense>
      <BookingScreen />
    </Suspense>
  );
}
