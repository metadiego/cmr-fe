import { redirect } from "next/navigation";

// The old services day sheet is gone: an old link or bookmark lands on the booking calendar at that day,
// in the clinic it named (`?centro=`).
export default async function OldServiceDayPage({
  params,
  searchParams,
}: {
  params: Promise<{ date: string }>;
  searchParams: Promise<{ centro?: string | string[] }>;
}) {
  const { date } = await params;
  const { centro } = await searchParams;
  const q = new URLSearchParams({ date });
  if (typeof centro === "string" && centro) q.set("centro", centro);
  redirect(`/scheduling/appointments?${q}`);
}
