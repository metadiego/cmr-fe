// Check for "Save appointment" in the post-visit scheduling modal (components/tablero/nueva-cita-modal.tsx):
// it needs an appointment type and a return date. Doctor and notes are optional.

export type NextAppointmentField = "type" | "date";

/** Missing fields in on-screen order (date picker first, then the type chips). */
export function nextAppointmentMissing(s: { typeId: string; date: string }): NextAppointmentField[] {
  const out: NextAppointmentField[] = [];
  if (!s.date) out.push("date");
  if (!s.typeId) out.push("type");
  return out;
}
