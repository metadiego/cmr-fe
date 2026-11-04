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
