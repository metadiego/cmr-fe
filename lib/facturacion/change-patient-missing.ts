// Checks for «Change patient» on an issued invoice (components/facturacion/invoice-change-patient.tsx).

export type ChangePatientField = "patient" | "reason";

/** Empty required fields, in on-screen order (new patient, then reason). */
export function changePatientMissing(s: { patientId: string | null; reason: string }): ChangePatientField[] {
  const out: ChangePatientField[] = [];
  if (!s.patientId) out.push("patient");
  if (s.reason.trim() === "") out.push("reason");
  return out;
}
