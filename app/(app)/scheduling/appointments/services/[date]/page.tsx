"use client";

import { useParams, useSearchParams } from "next/navigation";

import { ServiceDayView } from "@/components/agenda/service-day-view";

// One day of the services calendar (/scheduling/appointments/services/<date>): panorama, hour
// occupancy and plan. Lives under the services tab's path, as the medical day sheet
// (/scheduling/appointments/<date>) lives under the medical one. `?centro=` = the clinic the services
// calendar was showing: the day is one clinic, opened there.
export default function ServiceDayPage() {
  const { date } = useParams<{ date: string }>();
  const centro = useSearchParams().get("centro");
  return <ServiceDayView fecha={date} centro={centro} />;
}
