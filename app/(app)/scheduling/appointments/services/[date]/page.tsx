"use client";

import { useParams } from "next/navigation";

import { ServiceDayView } from "@/components/agenda/service-day-view";

// One day of the services calendar (/scheduling/appointments/services/<date>): panorama, hour
// occupancy and plan. Lives under the services tab's path, as the medical day sheet
// (/scheduling/appointments/<date>) lives under the medical one.
export default function ServiceDayPage() {
  const { date } = useParams<{ date: string }>();
  return <ServiceDayView fecha={date} />;
}
