// Holidays as the booking calendar uses them: only active holidays that block the schedule count,
// as YYYY-MM-DD days. Structural input so this stays pure (the API type is Festivo in lib/api/festivos).
//
// GET /holidays ignores X-Tenant-ID: it answers for every center the user can read (an admin gets
// all of them), and a user scoped to several centers does not get the global ones (clinicId=null).
// So the callers fetch the center list AND scope=global, merge them (mergeHolidays) and keep only
// the booked center's rows plus the global ones here, with the BE's precedence
// (holidays-on-date.ts → holidaysOn): if the center has a holiday on a date, the center's level wins
// over the global one for that date.

export interface HolidayLike {
  id?: string | null;
  date: string;
  active?: boolean | null;
  blocksSchedule?: boolean | null;
  /** null/undefined = global (every center). */
  clinicId?: string | null;
}

/** Several holiday lists as one, without duplicates (same id, or same day + center + flags when no id). */
export function mergeHolidays<T extends HolidayLike>(lists: T[][]): T[] {
  const seen = new Set<string>();
  const out: T[] = [];
  for (const f of lists.flat()) {
    const key = f.id ?? `${f.date.slice(0, 10)}|${f.clinicId ?? ""}|${f.active}|${f.blocksSchedule}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(f);
  }
  return out;
}

// Day of week for a "YYYY-MM-DD" day string, in UTC (the day has no timezone of its own — this
// must never shift with the viewer's clock, same reasoning as addDaysToDay). 0 = Sunday.
export function dayOfWeekUTC(iso: string): number {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d)).getUTCDay();
}

/** Sunday, or a day in the center's own blocking-holiday set — the two reasons a booking day is
 *  disabled in the calendar (handoff-citas-domingos-y-feriados). `holidays` is the output of
 *  `holidayDates` (already filtered to this center + global, already "blocks" only). */
export function isBlockedBookingDay(iso: string, holidays: ReadonlySet<string> | readonly string[]): boolean {
  if (dayOfWeekUTC(iso) === 0) return true;
  const set = holidays instanceof Set ? holidays : new Set(holidays);
  return set.has(iso);
}

/**
 * Blocking, active holidays of `center` (its own and the global ones) as YYYY-MM-DD, sorted and
 * unique. A missing flag counts as true. Another center's holiday never counts.
 */
export function holidayDates(list: HolidayLike[], center: string): string[] {
  const active = list.filter((f) => f.active !== false && (f.clinicId == null || f.clinicId === center));
  const byDay = new Map<string, HolidayLike[]>();
  for (const f of active) {
    const d = f.date.slice(0, 10);
    byDay.set(d, [...(byDay.get(d) ?? []), f]);
  }
  const out: string[] = [];
  for (const [d, rows] of byDay) {
    const own = rows.filter((f) => f.clinicId === center);
    const winners = own.length ? own : rows;
    if (winners.some((f) => f.blocksSchedule !== false)) out.push(d);
  }
  return out.sort();
}
