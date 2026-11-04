// Which centers the patient list shows (owner, 02-nov-2026). The BE reads every center where the person
// has pacientes.read when no `centerIds` is sent (cmr-be clinic-read-scope), so the list loads at once and
// only the filter sends `centerIds`. The clinic column follows what the response covered
// (`meta.clinicScope.clinicIds`), the filter follows the centers the person can read.

export type PatientCenterScope = {
  /** What to send as `centerIds`; undefined = every center the person can read. */
  centerIds: string[] | undefined;
  showFilter: boolean;
  showColumn: boolean;
};

/**
 * `readable`: centers where the person has pacientes.read (empty while not loaded). `selected`: the
 * filter's choice (null = all); a choice that no longer applies falls back to all. `covered`: the
 * centers the last response covered.
 */
export function patientCenterScope(
  readable: readonly string[],
  selected: readonly string[] | null,
  covered: readonly string[] | undefined,
): PatientCenterScope {
  const chosen = (selected ?? []).filter((id) => readable.includes(id));
  return {
    centerIds: chosen.length > 0 ? chosen : undefined,
    showFilter: readable.length > 1,
    showColumn: (covered?.length ?? 0) > 1,
  };
}

/** The record's link: the BE finds it by id in every center the person can read. */
export function patientRecordHref(patient: { id: string }): string {
  return `/patients/${patient.id}`;
}
