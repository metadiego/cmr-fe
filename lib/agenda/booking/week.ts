import { addDays, weekdayOf } from "../recurring-plan.ts";
import { inWindow, type DaySlots, type TimeWindow } from "./availability.ts";

// Week grid of the booking calendar: Monday–Saturday columns (the clinic is closed on Sunday) × hour
// rows. Pure UTC day arithmetic, like month.ts.

/**
 * Monday of the week `date` falls in. A Sunday belongs to the week that starts the next day: Sunday is
 * not shown, so the week a receptionist wants on a Sunday is the coming one.
 */
export function weekStart(date: string): string {
  const wd = weekdayOf(date);
  return wd === 0 ? addDays(date, 1) : addDays(date, 1 - wd);
}

/** The six shown days (Monday–Saturday) of the week `date` falls in. */
export function weekDays(date: string): string[] {
  const start = weekStart(date);
  return Array.from({ length: 6 }, (_, i) => addDays(start, i));
}

/** The Monday `delta` weeks away from the week `date` falls in. */
export function shiftWeek(date: string, delta: number): string {
  return addDays(weekStart(date), 7 * delta);
}

/** "07:20" → "07". */
export function hourOf(time: string): string {
  return time.slice(0, 2);
}

/**
 * The hour rows the week needs: every hour ("HH") where some day has a bookable (open or full) time in
 * the window, sorted. Hours made only of unavailable times are left out.
 */
export function weekHours(days: DaySlots[], w: TimeWindow): string[] {
  const hours = new Set<string>();
  for (const d of days) {
    for (const s of d.slots) {
      if (s.state !== "unavailable" && inWindow(s.time, w)) hours.add(hourOf(s.time));
    }
  }
  return [...hours].sort();
}

export interface WeekCell {
  free: number;
  booked: number;
  capacity: number;
  /** The time a click picks: the hour's first time with room, else its first (full) time. */
  time: string;
}

/** One day × hour: its bookable times in the window summed up, or null when it has none. */
export function weekCell(day: DaySlots, hour: string, w: TimeWindow): WeekCell | null {
  const slots = day.slots.filter(
    (s) => s.state !== "unavailable" && hourOf(s.time) === hour && inWindow(s.time, w),
  );
  if (slots.length === 0) return null;
  let free = 0;
  let capacity = 0;
  for (const s of slots) {
    free += Math.max(s.free, 0);
    capacity += s.capacity;
  }
  const open = slots.find((s) => s.free > 0);
  return { free, booked: Math.max(capacity - free, 0), capacity, time: (open ?? slots[0]).time };
}

/** "07" → "7:00", "13" → "13:00" (24-hour digits, like the day panel's times). */
export function hourLabel(hour: string): string {
  return `${Number(hour)}:00`;
}

/** The week's days that are asked for: from today on, no holidays (Sundays are never in the week). */
export function bookableWeekDays(days: string[], todayIso: string, holidays: string[]): string[] {
  return days.filter((d) => d >= todayIso && weekdayOf(d) !== 0 && !holidays.includes(d));
}
