import { addDays, weekdayOf } from "../recurring-plan.ts";

// Month grid for the booking calendar. Pure UTC day arithmetic (never the browser's timezone).

function pad(n: number): string {
  return String(n).padStart(2, "0");
}

// Sunday-first weeks covering the month, with only as many weeks as needed.
export function monthWeeks(year: number, month0: number): string[][] {
  const first = `${year}-${pad(month0 + 1)}-01`;
  const lastDay = new Date(Date.UTC(year, month0 + 1, 0, 12)).getUTCDate();
  const last = `${year}-${pad(month0 + 1)}-${pad(lastDay)}`;
  const start = addDays(first, -weekdayOf(first));
  const end = addDays(last, 6 - weekdayOf(last));
  const weeks: string[][] = [];
  for (let d = start; d <= end; d = addDays(d, 7)) {
    weeks.push(Array.from({ length: 7 }, (_, i) => addDays(d, i)));
  }
  return weeks;
}

export type DayKind = "past" | "outside" | "sunday" | "holiday" | "bookable";

export function dayKind(
  date: string,
  month0: number,
  todayIso: string,
  holidays: string[],
): DayKind {
  if (Number(date.slice(5, 7)) - 1 !== month0) return "outside";
  if (date < todayIso) return "past";
  if (weekdayOf(date) === 0) return "sunday";
  if (holidays.includes(date)) return "holiday";
  return "bookable";
}

export function bookableDays(
  weeks: string[][],
  month0: number,
  todayIso: string,
  holidays: string[],
): string[] {
  return weeks.flat().filter((d) => dayKind(d, month0, todayIso, holidays) === "bookable");
}

export type MonthRef = { year: number; month0: number };

/** The month a YYYY-MM-DD day falls in. */
export function monthOf(iso: string): MonthRef {
  return { year: Number(iso.slice(0, 4)), month0: Number(iso.slice(5, 7)) - 1 };
}

/** `m` moved by `delta` months (negative goes back), across year boundaries. */
export function shiftMonth(m: MonthRef, delta: number): MonthRef {
  const i = m.year * 12 + m.month0 + delta;
  return { year: Math.floor(i / 12), month0: ((i % 12) + 12) % 12 };
}

/** CSS `grid-template-rows` for the month: a week that is wholly before today has nothing to book, so it
 *  folds to one line (the day numbers) and leaves the height to the weeks that do; every other week never
 *  shrinks below what a cell prints (day, count, label). Without the floor a short screen (1366x768 with
 *  the day panel underneath) squeezed the rows until the counts overlapped the next week. */
export function monthRowsTemplate(weeks: string[][], todayIso: string): string {
  return weeks
    .map((w) => (w.every((d) => d < todayIso) ? "1.75rem" : "minmax(4.5rem, 1fr)"))
    .join(" ");
}
