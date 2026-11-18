// Checks for the reschedule / move dialog (components/citas/cita-actions.tsx). Same conditions the button
// used before: a date, the doctor only when a follow-up moves to another clinic, and a reason (trimmed).
// The hour stays optional (the API keeps the current one when none is sent).

export type RescheduleField = "date" | "doctor" | "reason";

/** Required fields still empty, in on-screen order. */
export function rescheduleMissing(s: {
  date: string;
  /** A follow-up moving to another clinic must name its doctor there. */
  doctorRequired: boolean;
  doctorId: string;
  reason: string;
}): RescheduleField[] {
  const out: RescheduleField[] = [];
  if (!s.date.trim()) out.push("date");
  if (s.doctorRequired && !s.doctorId) out.push("doctor");
  if (!s.reason.trim()) out.push("reason");
  return out;
}
