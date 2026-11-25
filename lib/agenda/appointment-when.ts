import { shiftDay } from "./appointment-form.ts";

// The «Cuándo» side of the appointment dialog (components/agenda/appointment-when-fields.tsx): the week
// strip, moving a week, the day's hours split into morning and afternoon, a day's free places, and which
// hour is really chosen. Pure, so it is tested here.

type HourSlot = { time: string; vacios: number };

function weekday(date: string): number {
  return new Date(`${date.slice(0, 10)}T12:00:00Z`).getUTCDay();
}

/** Monday to Saturday of `date`'s week (a Sunday: the week it closes), each marked when before `today`. */
export function weekStrip(date: string, today: string): { date: string; past: boolean }[] {
  const wd = weekday(date);
  const monday = shiftDay(date, wd === 0 ? -6 : 1 - wd);
  return Array.from({ length: 6 }, (_, i) => {
    const d = shiftDay(monday, i);
    return { date: d, past: d < today };
  });
}

/** The same weekday `weeks` away; never before `today`, and a Sunday today moves on to Monday. */
export function shiftWeek(date: string, weeks: number, today: string): string {
  const next = shiftDay(date, weeks * 7);
  if (next >= today) return next;
  return weekday(today) === 0 ? shiftDay(today, 1) : today;
}

/** The day's hours before noon and from noon on. */
export function dayParts<T extends HourSlot>(slots: readonly T[]): { morning: T[]; afternoon: T[] } {
  return {
    morning: slots.filter((s) => s.time.slice(0, 5) < "12:00"),
    afternoon: slots.filter((s) => s.time.slice(0, 5) >= "12:00"),
  };
}

/** A day's free places across its hours; null when it has no hours (nothing to count). */
export function dayFree(slots: readonly HourSlot[]): number | null {
  return slots.length ? slots.reduce((n, s) => n + Math.max(0, s.vacios), 0) : null;
}

/**
 * The hour the dialog really books. A preset hour (the desk opens it at the current hour) that the
 * loaded day does not offer is dropped, so the footer never shows an hour nobody chose. Kept as given
 * on edit or when picked on a calendar (`keep`), while the hours load, and for a type with no hours
 * (the free dropdown).
 */
export function chosenTime(p: { time: string; slots: readonly HourSlot[]; loaded: boolean; keep: boolean }): string {
  if (p.keep || !p.loaded || p.slots.length === 0) return p.time;
  return p.slots.some((s) => s.time === p.time) ? p.time : "";
}
