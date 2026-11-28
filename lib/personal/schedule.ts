// «Horario» on the staff record = the person's agenda (`staff_schedules`, cmr-be handoff §2.3).
// Pure, run with `npm test`.

/** A row of `GET /doctors/schedules` (the fields this screen reads). */
export interface ScheduleRow {
  id: string;
  /** null = the center's general row, not the person's. */
  staffId: string | null;
  clinicId: string;
  clinicName?: string | null;
  /** 0 = Sunday … 6 = Saturday. */
  dayOfWeek: number;
  startTime: string;
  endTime: string;
  active: boolean;
}

/** Monday → Sunday. */
export const WEEK = [1, 2, 3, 4, 5, 6, 0] as const;

/** The person's own active rows, and the center general rows the GET fills in for their empty days. */
export function splitRows(rows: readonly ScheduleRow[], staffId: string): { own: ScheduleRow[]; general: ScheduleRow[] } {
  const live = rows.filter((r) => r.active);
  return { own: live.filter((r) => r.staffId === staffId), general: live.filter((r) => r.staffId === null) };
}

/** Every day of the week (empty days included), rows sorted by start then center name. */
export function byDay(rows: readonly ScheduleRow[]): Map<number, ScheduleRow[]> {
  const m = new Map<number, ScheduleRow[]>(WEEK.map((d) => [d, []]));
  for (const r of rows) m.get(r.dayOfWeek)?.push(r);
  for (const list of m.values()) {
    list.sort((a, b) => a.startTime.localeCompare(b.startTime) || (a.clinicName ?? "").localeCompare(b.clinicName ?? ""));
  }
  return m;
}

const HHMM = /^([01]\d|2[0-3]):[0-5]\d$/;

/** Why a pair of hours cannot be saved; null = it can. Same rule as the BE (`disponibilidad.horario_imposible`). */
export function hoursProblem(start: string, end: string): "missing" | "format" | "endBeforeStart" | null {
  if (!start || !end) return "missing";
  if (!HHMM.test(start) || !HHMM.test(end)) return "format";
  if (end <= start) return "endBeforeStart";
  return null;
}

/** A PUT never changes the center: moving a day = create in the new center, then deactivate the old row. */
export function moveCenterSteps(
  row: ScheduleRow,
  centerId: string,
  staffId: string,
): { create: { staffId: string; centerId: string; dayOfWeek: number; startTime: string; endTime: string }; deactivate: { id: string; centerId: string } } | null {
  if (centerId === row.clinicId) return null;
  return {
    create: { staffId, centerId, dayOfWeek: row.dayOfWeek, startTime: row.startTime, endTime: row.endTime },
    deactivate: { id: row.id, centerId: row.clinicId },
  };
}

/** One line of the week grid: a center, and each weekday's rows there (sorted by start). */
export interface WeekLine {
  clinicId: string;
  clinicName: string;
  days: Map<number, ScheduleRow[]>;
}

/** The person's rows as a center × weekday grid, centers by name. */
export function weekGrid(rows: readonly ScheduleRow[]): WeekLine[] {
  const byCenter = new Map<string, ScheduleRow[]>();
  for (const r of rows) byCenter.set(r.clinicId, [...(byCenter.get(r.clinicId) ?? []), r]);
  return [...byCenter.entries()]
    .map(([clinicId, list]) => ({ clinicId, clinicName: list[0].clinicName ?? "—", days: byDay(list) }))
    .sort((a, b) => a.clinicName.localeCompare(b.clinicName));
}

/** A run of consecutive weekdays (Monday-first order) with the same hours. */
export interface WeekSpan {
  from: number;
  to: number;
  startTime: string;
  endTime: string;
}

/** Each center's rows as compact spans («Lun–Sáb 07:00–17:00»), for a one-line summary. */
export function summarizeWeek(rows: readonly ScheduleRow[]): { clinicId: string; clinicName: string; spans: WeekSpan[] }[] {
  return weekGrid(rows).map((line) => {
    const spans: WeekSpan[] = [];
    let prevDay: number | null = null;
    for (const d of WEEK) {
      for (const r of line.days.get(d) ?? []) {
        const last = spans.find((s) => s.to === prevDay && s.startTime === r.startTime && s.endTime === r.endTime);
        if (last) last.to = d;
        else spans.push({ from: d, to: d, startTime: r.startTime, endTime: r.endTime });
      }
      prevDay = d;
    }
    return { clinicId: line.clinicId, clinicName: line.clinicName, spans };
  });
}
