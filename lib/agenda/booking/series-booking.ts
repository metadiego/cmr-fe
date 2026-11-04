import { addDays } from "../recurring-plan.ts";
import { normalizeTime, type DaySlots } from "./availability.ts";

// Pure helpers behind the service booking form's weekly series: the editable list of dates, the
// sessions default, the dates a suggestion must avoid, the time options of a row and the grouping of
// rows into booking requests (the bulk endpoint takes ONE time for all its dates).

export const MIN_SESSIONS = 2;
export const MAX_SESSIONS = 20;
export const DEFAULT_SESSIONS = 4;

/** How far past the last row the patient's existing sessions are read (the suggestion's forward search). */
export const SUGGESTION_LOOKAHEAD_DAYS = 8 * 7;

export function clampSessions(n: number): number {
  if (!Number.isFinite(n)) return DEFAULT_SESSIONS;
  return Math.min(MAX_SESSIONS, Math.max(MIN_SESSIONS, Math.round(n)));
}

/** Sessions left on the patient's package for this service when known (> 0), else 4; always 2–20. */
export function defaultSessions(sessionsLeft?: number | null): number {
  return sessionsLeft != null && sessionsLeft > 0 ? clampSessions(sessionsLeft) : DEFAULT_SESSIONS;
}

/** One date of the series as the user left it: `time` set = a per-row override of the series time. */
export interface SeriesItem {
  date: string;
  time?: string;
}

/** The `overrides` input of buildSeriesRows (by row index). */
export function overridesOf(items: SeriesItem[]): Record<number, string> {
  const out: Record<number, string> = {};
  items.forEach((it, i) => {
    if (it.time) out[i] = it.time;
  });
  return out;
}

/** Sets row `index`'s time; the series time itself clears the override. */
export function setRowTime(items: SeriesItem[], index: number, time: string, seriesTime: string): SeriesItem[] {
  const t = normalizeTime(time);
  return items.map((it, i) =>
    i === index ? { date: it.date, ...(t === normalizeTime(seriesTime) ? {} : { time: t }) } : it,
  );
}

/** "Use … instead": the row takes the suggested date and time. */
export function applySuggestion(
  items: SeriesItem[],
  index: number,
  s: { date: string; time: string },
  seriesTime: string,
): SeriesItem[] {
  const moved = items.map((it, i) => (i === index ? { date: s.date } : it));
  return setRowTime(moved, index, s.time, seriesTime);
}

export function dropRow(items: SeriesItem[], index: number): SeriesItem[] {
  return items.filter((_, i) => i !== index);
}

/**
 * Dates a suggestion for row `index` must not land on: the other rows (the BE keeps one session per
 * patient, service and date), the patient's existing sessions and the holidays.
 */
export function suggestionExclusions(
  rowDates: string[],
  index: number,
  existingDates: string[],
  holidays: string[],
): string[] {
  const others = rowDates.filter((_, i) => i !== index);
  return [...new Set([...others, ...existingDates, ...holidays])].sort();
}

/** First and last day to read the patient's existing sessions for (rows + the forward search). */
export function existingRange(dates: string[]): { from: string; to: string } | null {
  if (dates.length === 0) return null;
  const sorted = [...dates].sort();
  return { from: sorted[0], to: addDays(sorted[sorted.length - 1], SUGGESTION_LOOKAHEAD_DAYS) };
}

export interface TimeOption {
  time: string; // HH:mm
  full: boolean;
  disabled: boolean;
}

/**
 * The per-row time choices: that day's open and full times (full = overbook, allowed); unavailable
 * times are left out. The row's current time is kept (disabled) when the day does not offer it, so the
 * select still shows what the row holds.
 */
export function rowTimeOptions(day: DaySlots | null | undefined, current: string): TimeOption[] {
  const cur = normalizeTime(current);
  const out: TimeOption[] = (day?.slots ?? [])
    .filter((s) => s.state !== "unavailable")
    .map((s) => ({ time: normalizeTime(s.time), full: s.state === "full" || s.free <= 0, disabled: false }));
  if (!out.some((o) => o.time === cur)) {
    out.push({ time: cur, full: false, disabled: true });
    out.sort((a, b) => (a.time < b.time ? -1 : a.time > b.time ? 1 : 0));
  }
  return out;
}

/** Rows → one request per distinct time (first-seen order), each with its dates in order. */
export function groupByTime(rows: { date: string; time: string }[]): { time: string; dates: string[] }[] {
  const groups = new Map<string, string[]>();
  for (const r of rows) {
    const t = normalizeTime(r.time);
    const list = groups.get(t) ?? [];
    if (!list.includes(r.date)) list.push(r.date);
    groups.set(t, list);
  }
  return [...groups].map(([time, dates]) => ({ time, dates: [...dates].sort() }));
}

/** Requested dates the BE did not create (it skips a date the patient already has the service on). */
export function notCreated(requested: string[], createdDates: string[]): string[] {
  const made = new Set(createdDates.map((d) => d.slice(0, 10)));
  return requested.filter((d) => !made.has(d));
}
