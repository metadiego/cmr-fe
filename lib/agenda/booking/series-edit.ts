import { addDays, weekdayOf } from "../recurring-plan.ts";
import { normalizeTime, type DaySlots } from "./availability.ts";
import { MAX_SESSIONS, setRowTime, type SeriesItem } from "./series-booking.ts";
import { seriesDates } from "./series.ts";

// The row-list operations behind a weekly series once the user edits it by hand: change one row's
// date, add the next date, regenerate from start + every + count, and the checks a picked date must
// pass. Rows keep their position (a changed date stays where it was; an added date goes last).

/** A row as the form keeps it: `fitTime` = its date just changed, fit the time once that day loads. */
export interface EditableItem extends SeriesItem {
  fitTime?: boolean;
}

export type DateRejection = "past" | "sunday" | "taken";

/** The generated list: start + every N weeks, `count` dates, no per-row time. */
export function generateItems(start: string, everyWeeks: 1 | 2, count: number): EditableItem[] {
  return seriesDates(start, everyWeeks, count).map((date) => ({ date }));
}

/**
 * Why `date` cannot be row `index`'s date (index null = a new row): before today, a Sunday (the
 * clinic is closed) or already another row's date (the BE keeps one session per patient, service
 * and day). Null = allowed.
 */
export function rejectDate(
  items: SeriesItem[],
  index: number | null,
  date: string,
  today: string,
): DateRejection | null {
  if (date < today) return "past";
  if (weekdayOf(date) === 0) return "sunday";
  if (items.some((it, i) => i !== index && it.date === date)) return "taken";
  return null;
}

/** Row `index` takes `date` (its time override is kept and re-fitted once the day loads). */
export function replaceDate(items: EditableItem[], index: number, date: string): EditableItem[] {
  return items.map((it, i) => (i === index ? { ...it, date, fitTime: true } : it));
}

/**
 * The date "+ Add date" proposes: `everyWeeks` weeks after the latest row, stepping on by the same
 * cadence past Sundays, taken dates and the past. Null = none (no rows, or the max is reached).
 */
export function nextDate(items: SeriesItem[], everyWeeks: 1 | 2, today: string): string | null {
  if (items.length === 0 || items.length >= MAX_SESSIONS) return null;
  const latest = items.reduce((m, it) => (it.date > m ? it.date : m), items[0].date);
  let date = addDays(latest, everyWeeks * 7);
  // A Sunday row repeats on Sundays forever: step to Monday once, then keep the cadence.
  if (weekdayOf(date) === 0) date = addDays(date, 1);
  for (let guard = 0; guard < 60 && rejectDate(items, null, date, today); guard++) {
    date = addDays(date, everyWeeks * 7);
    if (weekdayOf(date) === 0) date = addDays(date, 1);
  }
  return rejectDate(items, null, date, today) ? null : date;
}

/** Appends `date` as a new row (series time, fitted once the day loads); max 20 rows. */
export function addItem(items: EditableItem[], date: string): EditableItem[] {
  if (items.length >= MAX_SESSIONS) return items;
  return [...items, { date, fitTime: true }];
}

/**
 * The time a row whose date changed should take on `day`: its own time when that slot is free, else
 * the day's first free time, else its own time unchanged (the status then shows full or closed).
 */
export function fittedTime(day: DaySlots | null, current: string): string {
  const cur = normalizeTime(current);
  const free = (day?.slots ?? []).filter((s) => s.state !== "unavailable" && s.free > 0);
  if (free.some((s) => normalizeTime(s.time) === cur)) return cur;
  return free.length ? normalizeTime(free[0].time) : cur;
}

/**
 * Resolves every `fitTime` row whose day has loaded (`days[date]` defined; "error" just clears the
 * flag). Returns the same array when nothing changed, so a caller can skip the state update.
 */
export function fitLoadedTimes(
  items: EditableItem[],
  days: Record<string, DaySlots | null | "error">,
  seriesTime: string,
): EditableItem[] {
  let changed = false;
  let out = items;
  items.forEach((it, i) => {
    if (!it.fitTime) return;
    const day = days[it.date];
    if (day === undefined) return;
    changed = true;
    const time = day === "error" ? normalizeTime(it.time ?? seriesTime) : fittedTime(day, it.time ?? seriesTime);
    out = setRowTime(out, i, time, seriesTime);
  });
  return changed ? out : items;
}
