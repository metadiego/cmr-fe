// Reads across clinics (cmr-be clinic-read-scope; handoff docs/specs/clinic-read-scope-handoff-fe.md).
// A read names its centers with `?centerIds=`, never by switching X-Tenant-ID: the BE reads those where
// the person has the screen's permission. Writes still go to one center through X-Tenant-ID.

/**
 * The `centerIds` of a read: the explicit list if any, else the screen's picked center. Sending the
 * picked center keeps a one-center screen on that center once the BE defaults to every readable one.
 */
export function readCenterIds(
  centroId: string | undefined,
  centerIds: readonly string[] | undefined,
): string[] | undefined {
  if (centerIds?.length) return [...centerIds];
  return centroId ? [centroId] : undefined;
}

/** True when the rows come from more than one clinic: then each row shows its clinic. */
export function spansClinics(rows: readonly { clinicId?: string | null }[]): boolean {
  return new Set(rows.map((r) => r.clinicId).filter(Boolean)).size > 1;
}
