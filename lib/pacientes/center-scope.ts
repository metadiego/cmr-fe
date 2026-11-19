/** The record's link: the BE finds it by id in every center the person can read. */
export function patientRecordHref(patient: { id: string }): string {
  return `/patients/${patient.id}`;
}
