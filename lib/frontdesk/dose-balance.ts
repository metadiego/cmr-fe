// Pure helpers behind the per-patient dose-balance map shared by every screen that renders a
// service's sessions through FilaSesion (ServiceSessionsTable in patient-desk, and the general
// service viewer): the SAME lookup serves the single-patient case (patient-desk, one key in the
// map) and the multi-patient case (the viewer, one key per patient on the board) without a row ever
// reading another patient's balance. cmr-fe #139.

// Which patients need a dose-balance fetch: every DISTINCT patientId among the given row ids, in
// first-seen order, skipping rows with no resolvable patient — and NONE at all when the service has
// no dose column, no matter how many rows/patients there are (hasDose gates the whole thing, not
// just whether a fetch result gets used).
export function patientsNeedingDoseBalance(
  rowIds: readonly string[],
  patientIdOf: (rowId: string) => string | null | undefined,
  hasDose: boolean,
): string[] {
  if (!hasDose) return [];
  const seen = new Set<string>();
  const out: string[] = [];
  for (const id of rowIds) {
    const patientId = patientIdOf(id);
    if (patientId && !seen.has(patientId)) {
      seen.add(patientId);
      out.push(patientId);
    }
  }
  return out;
}

// A row's own balance, never someone else's: an unresolved patient or a patient missing from the
// map both fall back to empty, never to another entry in `byPatient`.
export function doseBalanceForRow<T>(byPatient: Record<string, T[]>, patientId: string | null | undefined): T[] {
  if (!patientId) return [];
  return byPatient[patientId] ?? [];
}
