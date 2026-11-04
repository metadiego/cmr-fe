// Holidays as the booking calendar uses them: only active holidays that block the schedule count,
// as YYYY-MM-DD days. Structural input so this stays pure (the API type is Festivo in lib/api/festivos).

export interface HolidayLike {
  date: string;
  active?: boolean | null;
  blocksSchedule?: boolean | null;
}

/** Blocking, active holidays as YYYY-MM-DD (a missing flag counts as true). */
export function holidayDates(list: HolidayLike[]): string[] {
  return list.filter((f) => f.active !== false && f.blocksSchedule !== false).map((f) => f.date.slice(0, 10));
}
