// Checks for the train-series dialog (components/agenda/train-series-modal.tsx). The fields are what
// «Calculate» needs: a start date, a preferred time and at least one weekday. «Until», «At most» and the
// per-therapy session counts are optional (the backend deduces counts from what was purchased). Booking
// also needs a calculated plan with at least one planned day: not a field, so a block with its reason.

import { recurringBookingMissing, type RecurringBookingField } from "./recurring-booking-missing.ts";

export type TrainSeriesField = RecurringBookingField;

/** Required fields still empty, in on-screen order (same three fields as the single-therapy series). */
export function trainSeriesMissing(s: { startDate: string; time: string; weekdayCount: number }): TrainSeriesField[] {
  return recurringBookingMissing(s);
}

export type TrainSeriesBlock = "notCalculated" | "nothingPlanned";

type Day = { status: string; time?: string | null };

/** Days that will be booked: planned and with a resolved time (the only ones sent to the backend). */
export function bookableTrainDays<D extends Day>(days: readonly D[]): (D & { time: string })[] {
  return days.filter((d): d is D & { time: string } => d.status === "planned" && !!d.time);
}

/** Why «Confirm» cannot book yet, or null. `plan` is the calculation (null before one is run). */
export function trainSeriesBlock(plan: { days: readonly Day[] } | null): TrainSeriesBlock | null {
  if (!plan) return "notCalculated";
  if (bookableTrainDays(plan.days).length === 0) return "nothingPlanned";
  return null;
}
