"use client";

import { redirect, useParams, useSearchParams } from "next/navigation";

import { DiaView } from "@/components/agenda/dia-view";

// Day view reached by clicking a day in the medical calendar: the call-center day sheet (DiaView).
// An old link to this route with `?tab=servicios` (the services day) lands on the booking calendar at
// that day.
export default function AgendaDiaPage() {
  // The route segment is `date` (folder `[date]`), not `fecha`: reading it under the wrong name sent
  // `date=undefined` to the BE and the day view never loaded.
  const params = useParams<{ date: string }>();
  const oldServicesLink = useSearchParams().get("tab") === "servicios";
  if (oldServicesLink) redirect(`/scheduling/appointments?date=${encodeURIComponent(params.date)}`);
  return <DiaView fecha={params.date} />;
}
