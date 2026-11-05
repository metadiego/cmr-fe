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
  /** The top bar is on «Ambos»: a read with no picked center reads every center in scope. */
  viewAll = false,
): string[] | undefined {
  if (tenant === null || (tenant === undefined && viewAll)) return undefined;
  if (tenant !== undefined && typeof tenant !== "string") return tenant.length ? [...tenant] : undefined;
  const id = tenant ?? activeCenterId ?? sessionCenterId;
  return id ? [id] : undefined;
}

/**
 * The clinic filter's choice as a read asks for it: the ticked clinics that are still readable, or every
 * readable clinic when nothing (or only stale ids) is ticked — named explicitly, with the active clinic
 * first when it is readable, because the first one becomes the request's X-Tenant-ID (`tenantOf`) and
 * the permission guards check THAT clinic. `null` only while the readable clinics are not known.
 */
export function clinicFilterChoice(
  readable: readonly string[],
  selected: readonly string[] | null,
  activeCenterId: string | null,
): string[] | null {
  if (readable.length === 0) return null;
  const chosen = (selected ?? []).filter((id) => readable.includes(id));
  const ids = chosen.length > 0 ? chosen : [...readable];
  return activeCenterId && ids.includes(activeCenterId)
    ? [activeCenterId, ...ids.filter((id) => id !== activeCenterId)]
    : ids;
}

/**
 * The X-Tenant-ID of a read: a single picked center, or the FIRST of a list (a clinic where the person
 * holds the screen's permission, so the guards let the read in). Every center (`null`) or the default
 * (`undefined`) forces nothing.
 */
export function tenantOf(choice: CenterChoice): string | undefined {
  if (typeof choice === "string") return choice;
  return choice?.[0];
}

/**
 * What the top bar (Bayamón / Caguas / Ambos, docs/specs/selector-de-centros-arriba.md) ticks for a list:
 * its one clinic, or nothing on «Ambos» — `clinicFilterChoice` then names every readable clinic.
 */
export function topBarSelection(viewAll: boolean, activeCenterId: string | null): string[] | null {
  return !viewAll && activeCenterId ? [activeCenterId] : null;
}
