// «Cambios de un día» on the staff record (cmr-be handoff §2.4): one day somewhere else, other hours,
// or not coming. Pure, run with `npm test`.
import { hoursProblem } from "./schedule.ts";

/** The select value for «No viene» (the BE's `centerId: null`). */
export const NOT_COMING = "__not_coming__";

export interface DayChangeDraft {
  /** YYYY-MM-DD */
  day: string;
  /** A center id, or NOT_COMING. */
  center: string;
  startTime: string;
  endTime: string;
  note: string;
}

export type DayChangeProblem = "pastDay" | "bothHours" | "format" | "endBeforeStart" | "noHoursWhenAway" | null;

/** Filled-in but invalid (a reason, never "missing"). `today` = YYYY-MM-DD at the home center. */
export function dayChangeProblem(d: DayChangeDraft, today: string): DayChangeProblem {
  if (d.day && d.day < today) return "pastDay";
  const anyHour = !!d.startTime || !!d.endTime;
  if (d.center === NOT_COMING) return anyHour ? "noHoursWhenAway" : null;
  if (!anyHour) return null;
  if (!d.startTime || !d.endTime) return "bothHours";
  const p = hoursProblem(d.startTime, d.endTime);
  return p === "format" ? "format" : p ? "endBeforeStart" : null;
}

export function dayChangeBody(d: DayChangeDraft): { centerId: string | null; startTime?: string; endTime?: string; note?: string } {
  const note = d.note.trim();
  const away = d.center === NOT_COMING;
  return {
    centerId: away ? null : d.center,
    ...(!away && d.startTime && d.endTime ? { startTime: d.startTime, endTime: d.endTime } : {}),
    ...(note ? { note } : {}),
  };
}
