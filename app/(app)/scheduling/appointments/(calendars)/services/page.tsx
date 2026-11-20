import { Suspense } from "react";

import { BookingScreen } from "@/components/appointments-booking/booking-screen";

// /scheduling/appointments/services: the old Services tab. Inbound links (frontdesk, patient desk,
// the service day screen's back link) land on the same booking screen as /scheduling/appointments.
export default function AppointmentsServicesPage() {
  return (
    <Suspense>
      <BookingScreen />
    </Suspense>
  );
}
