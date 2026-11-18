// Checks for the appointment create/edit dialog (components/agenda/cita-modal.tsx). Same conditions the
// «Guardar» button used before: clinic (only where the dialog asks for it), date, hour, patient, the
// doctor only when the type requires one, and the type. The end time is derived from the start, so a
// blank one is reported as the hour.

export type AppointmentField = "clinic" | "date" | "time" | "patient" | "doctor" | "type";

/** Required fields still empty, in on-screen order. */
export function appointmentMissing(s: {
  /** The clinic picker is shown (create, several clinics). */
  clinicPicker: boolean;
  clinicId: string;
  date: string;
  /** Start HH:MM. */
  time: string;
  /** End HH:MM (derived from the start). */
  endTime: string;
  patientId: string | null | undefined;
  /** The type requires a doctor for this patient. */
  doctorRequired: boolean;
  doctorId: string;
  typeId: string;
}): AppointmentField[] {
  const out: AppointmentField[] = [];
  if (s.clinicPicker && !s.clinicId) out.push("clinic");
  if (!s.date.trim()) out.push("date");
  if (!s.time.trim() || !s.endTime.trim()) out.push("time");
  if (!s.patientId) out.push("patient");
  if (s.doctorRequired && !s.doctorId) out.push("doctor");
  if (!s.typeId) out.push("type");
  return out;
}
