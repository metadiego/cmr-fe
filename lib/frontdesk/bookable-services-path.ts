// Path of GET /frontdesk/patients/:id/bookable-services. Pure (no client/env import) so it is testable.
// `centerIds` goes as a repeated key (centerIds=a&centerIds=b), never comma-joined.
export function bookableServicesPath(patientId: string, centerIds: string[]): string {
  const sp = new URLSearchParams();
  for (const id of centerIds) sp.append("centerIds", id);
  const qs = sp.toString();
  return `/frontdesk/patients/${encodeURIComponent(patientId)}/bookable-services${qs ? `?${qs}` : ""}`;
}
