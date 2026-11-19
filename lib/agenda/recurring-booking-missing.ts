// Checks for the "schedule a series" dialog (components/agenda/recurring-booking-modal.tsx). The fields
// are what the preview needs: a start date, a preferred time and at least one weekday. The session
// count is clamped to >= 1 by its input, so it can never be empty. Booking also needs a preview with at
// least one date that found a slot: that is not a field, so it is a block with its own reason.

export type RecurringBookingField = "startDate" | "time" | "weekdays";

/** Required fields still empty, in on-screen order. */
export function recurringBookingMissing(s: { startDate: string; time: string; weekdayCount: number }): RecurringBookingField[] {
  const out: RecurringBookingField[] = [];
  if (!s.startDate.trim()) out.push("startDate");
  if (!s.time.trim()) out.push("time");
  if (s.weekdayCount === 0) out.push("weekdays");
  return out;
}

export type RecurringBookingBlock = "noPreview" | "nothingBookable";

/** Why «Confirm» cannot book yet, or null. `plan` is the preview (null before one is run). */
export function recurringBookingBlock(plan: readonly { status: string }[] | null): RecurringBookingBlock | null {
  if (!plan || plan.length === 0) return "noPreview";
  if (!plan.some((i) => i.status !== "unresolved")) return "nothingBookable";
  return null;
}
