import { addDays } from "../recurring-plan.ts";
import { monthOf, type MonthRef } from "./month.ts";
import { weekDays, weekStart } from "./week.ts";

// The booking calendar's three views (Day / Week / Month) and the day each one is "about", used to
// carry the place over when the view changes. Pure, no app imports.

export type BookingPeriod = "day" | "week" | "month";

export const PERIODS: BookingPeriod[] = ["day", "week", "month"];

export function isPeriod(s: string | null | undefined): s is BookingPeriod {
  return s === "day" || s === "week" || s === "month";
}

/** D / W / M (any case) → the view; anything else → null. */
export function periodForKey(key: string): BookingPeriod | null {
  const k = key.toLowerCase();
  return k === "d" ? "day" : k === "w" ? "week" : k === "m" ? "month" : null;
}

function inMonth(date: string, m: MonthRef): boolean {
  const d = monthOf(date);
  return d.year === m.year && d.month0 === m.month0;
}

/**
 * The day the current view is about, never before today: Day → its day; Week → the selected day when it
 * is in the shown week, else the week's Monday; Month → the selected day when it is in the shown month,
 * else today when the month is the current one, else the month's first day.
 */
export function periodFocus(
  p: { period: BookingPeriod; date?: string; anchor: string; month: MonthRef },
  todayIso: string,
): string {
  let focus: string;
  if (p.period === "day") {
    focus = p.date ?? todayIso;
  } else if (p.period === "week") {
    focus = p.date && weekDays(p.anchor).includes(p.date) ? p.date : weekStart(p.anchor);
  } else if (p.date && inMonth(p.date, p.month)) {
    focus = p.date;
  } else if (inMonth(todayIso, p.month)) {
    focus = todayIso;
  } else {
    focus = `${p.month.year}-${String(p.month.month0 + 1).padStart(2, "0")}-01`;
  }
  return focus < todayIso ? todayIso : focus;
}

/** Day view's ‹ ›: one day, skipping nothing (a closed day shows "Closed"). */
export function shiftDay(date: string, delta: number): string {
  return addDays(date, delta);
}
