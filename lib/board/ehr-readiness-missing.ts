// Checks for the EHR readiness dialog (components/tablero/ehr-readiness-modal.tsx): every field the
// readiness check reports as missing is required here; a birth date in the future is filled but invalid.

import type { EhrReadinessField } from "../api/ehr-integration.ts";

// Display order: the ID type BEFORE the ID (owner's rule, 30-sep) — an ID number without its document
// type is useless. The BE may send `faltantes` in any order.
const FIELD_ORDER: readonly EhrReadinessField[] = ["idType", "docId", "fechaNacimiento", "sexo", "zipcode"];

/** The requested fields in display order. */
export function ehrReadinessOrder(faltantes: readonly EhrReadinessField[]): EhrReadinessField[] {
  return [...faltantes].sort((a, b) => FIELD_ORDER.indexOf(a) - FIELD_ORDER.indexOf(b));
}

/** Requested fields still blank, in display order. */
export function ehrReadinessMissing(
  faltantes: readonly EhrReadinessField[],
  form: Record<string, string>,
): EhrReadinessField[] {
  return ehrReadinessOrder(faltantes).filter((f) => (form[f] ?? "").trim() === "");
}

/** "futureBirthDate" when a birth date is typed and is after `today` (YYYY-MM-DD); null otherwise. */
export function ehrReadinessInvalid(form: Record<string, string>, today: string): "futureBirthDate" | null {
  const d = form.fechaNacimiento;
  return d && d > today ? "futureBirthDate" : null;
}
