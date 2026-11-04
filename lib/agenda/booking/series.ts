import type { RecurringPlanItem } from "../recurring-plan.ts";
import { addDays } from "../recurring-plan.ts";
import { normalizeTime, type DaySlots } from "./availability.ts";

// Rows of a weekly series of one service ("every N weeks at this time"), each checked against real
// availability, holidays and days the patient already has the service.

export function seriesDates(start: string, everyWeeks: 1 | 2, count: number): string[] {
  return Array.from({ length: count }, (_, i) => addDays(start, i * everyWeeks * 7));
}

export type SeriesRowStatus = "free" | "full" | "blocked";
export type SeriesBlockReason = "closed" | "holiday" | "duplicate";

export interface SeriesRow {
  index: number;
  date: string;
  time: string; // HH:mm
  status: SeriesRowStatus;
  reason: SeriesBlockReason | null;
  suggestion: { date: string; time: string } | null;
}

export function buildSeriesRows(input: {
  dates: string[];
  time: string;
  overrides: Record<number, string>;
  days: Record<string, DaySlots | null>;
  holidays: string[];
  existingDates: string[];
  plan?: RecurringPlanItem[];
}): SeriesRow[] {
  return input.dates.map((date, index) => {
    const time = normalizeTime(input.overrides[index] ?? input.time);
    let status: SeriesRowStatus;
    let reason: SeriesBlockReason | null = null;
    if (input.holidays.includes(date)) {
      status = "blocked";
      reason = "holiday";
    } else if (input.existingDates.includes(date)) {
      status = "blocked";
      reason = "duplicate";
    } else {
      const slot = input.days[date]?.slots.find((s) => normalizeTime(s.time) === time);
      if (!slot || slot.state === "unavailable") {
        status = "blocked";
        reason = "closed";
      } else {
        status = slot.free > 0 ? "free" : "full";
      }
    }
    let suggestion: SeriesRow["suggestion"] = null;
    if (status !== "free") {
      const p = input.plan?.find((x) => x.index === index);
      if (p && (p.status === "adjustedTime" || p.status === "adjustedDate")) {
        suggestion = { date: p.date, time: normalizeTime(p.time) };
      }
    }
    return { index, date, time, status, reason, suggestion };
  });
}

export function canBookSeries(rows: SeriesRow[]): boolean {
  return !rows.some((r) => r.status === "blocked");
}
