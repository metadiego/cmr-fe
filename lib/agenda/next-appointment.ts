// The patient's NEXT appointment, as the board's "Next appt" column (binding `cita.proxCita`) derives it
// in the BE (citas.service `proximasCitas`): the first appointment strictly AFTER the board's day that is
// not cancelled, a no-show or already rescheduled. The column only carries the date; the cell needs the
// appointment itself (id, time, doctor) to move it, so it applies the same rule to GET /appointments.

export type NextAppointmentCandidate = {
  id: string;
  date: string; // YYYY-MM-DD
  time?: string | null; // HH:mm[:ss]
  status?: string | null;
};

// States that are no longer a pending visit — the same exclusion list as the BE.
const NOT_PENDING = new Set(["cancelada", "no_show", "reprogramada"]);

// States an appointment can be rescheduled FROM (components/citas/cita-actions.tsx, ACTIONS map).
const RESCHEDULABLE = new Set(["programada", "confirmada"]);

export function pickNextAppointment<T extends NextAppointmentCandidate>(
  appointments: T[],
  afterDate: string,
): T | null {
  const pending = appointments.filter(
    (a) => a.date > afterDate && !NOT_PENDING.has(String(a.status ?? "")),
  );
  pending.sort(
    (a, b) => a.date.localeCompare(b.date) || String(a.time ?? "").localeCompare(String(b.time ?? "")),
  );
  return pending[0] ?? null;
}

export function canReschedule(a: NextAppointmentCandidate | null): boolean {
  return !!a && RESCHEDULABLE.has(String(a.status ?? ""));
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
