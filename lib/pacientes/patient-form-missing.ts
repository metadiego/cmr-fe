// Checks for the patient create/edit sheet (components/clientes/paciente-form-sheet.tsx).
// The first name is always required; every other field only when the clinic's patient-intake config
// lists it (GET config, never hardcoded). The clinic picker counts only where the sheet shows it.

/** The sheet's fields in on-screen order (the clinic picker, when shown, comes first). */
export const PATIENT_FORM_FIELDS = [
  "nombres",
  "apellidos",
  "docId",
  "sexo",
  "fechaNacimiento",
  "nacionalidad",
  "telefono",
  "whatsapp",
  "email",
  "zipcode",
  "direccion",
  "record",
  "aseguradora",
  "medicoId",
] as const;

export type PatientFormField = "clinic" | (typeof PATIENT_FORM_FIELDS)[number];

/** Required fields still blank (after trim), in on-screen order. */
export function patientFormMissing(s: {
  form: Readonly<Record<string, string>>;
  /** Fields the clinic's config requires (anything the sheet does not capture is ignored). */
  required: readonly string[];
  /** The clinic picker is shown and nothing is picked. */
  clinicMissing: boolean;
}): PatientFormField[] {
  const out: PatientFormField[] = s.clinicMissing ? ["clinic"] : [];
  for (const f of PATIENT_FORM_FIELDS) {
    const needed = f === "nombres" || s.required.includes(f);
    if (needed && !(s.form[f] ?? "").trim()) out.push(f);
  }
  return out;
}

export type PatientFormBlock = "clinicsLoading" | "futureBirthDate" | "duplicateRecord" | "checkingRecord";

/** Why the sheet cannot be saved although nothing is missing (first cause wins); null when it can. */
export function patientFormBlock(s: {
  /** Create with no clinic resolved and no picker shown (the clinic list has not loaded yet). */
  clinicsLoading: boolean;
  birthDate: string;
  /** Today, YYYY-MM-DD (Puerto Rico). */
  today: string;
  /** The record number already belongs to another patient. */
  duplicateRecord: boolean;
  /** The live duplicate check for the record number has not answered yet. */
  checkingRecord: boolean;
}): PatientFormBlock | null {
  if (s.clinicsLoading) return "clinicsLoading";
  if (s.birthDate && s.birthDate > s.today) return "futureBirthDate";
  if (s.duplicateRecord) return "duplicateRecord";
  if (s.checkingRecord) return "checkingRecord";
  return null;
}
