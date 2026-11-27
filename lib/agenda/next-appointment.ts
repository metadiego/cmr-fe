// The patient's NEXT appointment, as the board's "Next appt" column (binding `cita.proxCita`) derives it
// in the BE (citas.service `proximasCitas`): the first appointment strictly AFTER the board's day that is
// not cancelled, a no-show or already rescheduled. The column only carries the date; the cell needs the
// appointment itself (id, time, doctor) to move it, so it applies the same rule to GET /appointments.

import {
  BEFORE_ARRIVAL,
  NOT_OCCUPYING_THE_DAY,
  rowInGroups,
  type StagedRow,
} from "../lifecycle/stage-groups.ts";
import { dayOfWeekUTC } from "./booking/holidays.ts";

/** A medical appointment: its old status and/or its stage columns (read through `stagesOf`). */
export type NextAppointmentCandidate = StagedRow & {
  id: string;
  date: string; // YYYY-MM-DD
  time?: string | null; // HH:mm[:ss]
};

// No longer a pending visit (no-show, cancelled or not served, rescheduled): the same exclusion as
// the BE. A negative read, so a status the mapping does not know stays pending, as it did.
const isPending = (a: NextAppointmentCandidate) => !rowInGroups("medical", a, NOT_OCCUPYING_THE_DAY);

export function pickNextAppointment<T extends NextAppointmentCandidate>(
  appointments: T[],
  afterDate: string,
): T | null {
  const pending = appointments.filter(
    (a) => a.date > afterDate && isPending(a),
  );
  pending.sort(
    (a, b) => a.date.localeCompare(b.date) || String(a.time ?? "").localeCompare(String(b.time ?? "")),
  );
  return pending[0] ?? null;
}

export function canReschedule(a: NextAppointmentCandidate | null): boolean {
  // Only before arrival (booked or confirmed), like the appointment menu.
  return !!a && rowInGroups("medical", a, BEFORE_ARRIVAL.medical);
}

// "When is the patient back?" shortcuts, in days from TODAY (not from the current appointment: the
// question at the desk is "in a month", counted from now).
export const RETURN_SHORTCUTS = [
  { key: "quick1w", days: 7 },
  { key: "quick2w", days: 14 },
  { key: "quick1m", days: 30 },
  { key: "quick3m", days: 90 },
] as const;

export type ReturnShortcutKey = (typeof RETURN_SHORTCUTS)[number]["key"];

// A calendar day + N days, as a calendar day. Pure UTC arithmetic on the day, so no timezone can shift it.
export function addDaysToDay(day: string, days: number): string {
  const [y, m, d] = day.split("-").map(Number);
  const t = new Date(Date.UTC(y, m - 1, d + days));
  return t.toISOString().slice(0, 10);
}

// Handoff-citas-domingos-y-feriados: with no doctor chosen yet, a return-date chip can only skip
// Sunday client-side (holidays need the BE/doctor's own schedule) — the BE corrects the rest on save.
export function skipSundayClient(day: string): string {
  let d = day;
  while (dayOfWeekUTC(d) === 0) d = addDaysToDay(d, 1);
  return d;
}
