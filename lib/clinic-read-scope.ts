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

/**
 * The center a one-center read is about, as `centerIds`: the picked one (`tenant`), else the one the
 * X-Tenant-ID header carries (the active center, else the session's). `tenant === null` is a combined
 * view: nothing is sent and the BE reads every center in scope. Keeps one-center screens on one
 * center now that the BE defaults to every readable center.
 */
/**
 * What a read asks for: one picked center (`string`), several (`string[]`, from a clinic filter; empty
 * = every center in scope), every center in scope (`null`), or the one X-Tenant-ID carries (`undefined`).
 */
export type CenterChoice = string | readonly string[] | null | undefined;

export function oneCenterIds(
  tenant: CenterChoice,
  activeCenterId: string | null,
  sessionCenterId: string | null,
): string[] | undefined {
  if (tenant === null) return undefined;
  if (tenant !== undefined && typeof tenant !== "string") return tenant.length ? [...tenant] : undefined;
  const id = tenant ?? activeCenterId ?? sessionCenterId;
  return id ? [id] : undefined;
}

/**
 * The clinic filter's choice as a read asks for it: `null` (every readable clinic) when nothing, all,
 * or only stale ids are ticked; else the ticked clinics that are still readable.
 */
export function clinicFilterChoice(
  readable: readonly string[],
  selected: readonly string[] | null,
): string[] | null {
  const chosen = (selected ?? []).filter((id) => readable.includes(id));
  return chosen.length === 0 || chosen.length === readable.length ? null : chosen;
}

/** The clinic column: for anyone who can read more than one clinic, even when filtered to one. */
export function showsClinicColumn(readable: readonly string[]): boolean {
  return readable.length > 1;
}
