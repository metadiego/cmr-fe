import { redirect } from "next/navigation";

// The old services day sheet is gone: an old link or bookmark lands on the booking calendar at that day.
export default async function OldServiceDayPage({ params }: { params: Promise<{ date: string }> }) {
  const { date } = await params;
  redirect(`/scheduling/appointments?date=${encodeURIComponent(date)}`);
}
