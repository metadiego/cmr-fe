// Check for the board's "Add appointment" modal (components/tablero/agregar-cita-modal.tsx): a patient is
// always required; when saving MOVES the patient's open appointment, the reason for the change is too.
// Doctor, time and notes are optional.

export type AddAppointmentField = "patient" | "reason";

export function addAppointmentMissing(s: {
  hasPatient: boolean;
  moving: boolean;
  reason: string;
}): AddAppointmentField[] {
  const out: AddAppointmentField[] = [];
  if (!s.hasPatient) out.push("patient");
  if (s.moving && s.reason.trim() === "") out.push("reason");
  return out;
}
