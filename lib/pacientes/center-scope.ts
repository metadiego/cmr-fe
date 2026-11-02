// Which centers the patient list shows (owner, 02-nov-2026): every center the person may read
// patients in, from one BE call (`GET /patients?centerIds=a,b`, cmr-be PR #442). Someone with access
// to one center gets it pre-filtered, with no filter to touch; someone with more gets them all by
// default, a filter to narrow them, and a clinic column while more than one is listed.

export type PatientCenterScope = {
  /** What to send as `centerIds`; undefined = the session's center (centers not known yet). */
  centerIds: string[] | undefined;
  showFilter: boolean;
  showColumn: boolean;
};

/**
 * `readable`: centers where the person has pacientes.read. `selected`: the filter's choice
 * (null = all). A choice that no longer applies (empty, or outside `readable`) falls back to all.
 */
export function patientCenterScope(readable: readonly string[], selected: readonly string[] | null): PatientCenterScope {
  if (readable.length === 0) return { centerIds: undefined, showFilter: false, showColumn: false };
  const chosen = (selected ?? []).filter((id) => readable.includes(id));
  const centerIds = chosen.length > 0 ? chosen : [...readable];
  return { centerIds, showFilter: readable.length > 1, showColumn: centerIds.length > 1 };
}

/** The record's link. A patient of a center other than the session's carries it (?centro=). */
export function patientRecordHref(patient: { id: string; clinicId?: string | null }, sessionCenterId: string | null): string {
  const base = `/patients/${patient.id}`;
  return patient.clinicId && patient.clinicId !== sessionCenterId
    ? `${base}?centro=${encodeURIComponent(patient.clinicId)}`
    : base;
}
