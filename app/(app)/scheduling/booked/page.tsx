import { Suspense } from "react";

import { AppointmentsDayScreen } from "@/components/appointments-day/day-screen";

// /scheduling/booked: the Citas day screen (what is already booked for a day). Suspense: it reads the
// URL (useSearchParams) for its state. Spec: docs/specs/citas-day-screen.md.
export default function BookedAppointmentsPage() {
  return (
    <Suspense>
      <AppointmentsDayScreen />
    </Suspense>
  );
}
