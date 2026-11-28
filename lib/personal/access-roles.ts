// «Rol de acceso» on the staff record: the positions that are access roles, without the job positions
// (no permissions and a function of the same slug: doctor, nurse, technician…), which Functions now
// edits. The positions PUT takes the COMPLETE list, so the job positions held are re-sent untouched.
// Pure, run with `npm test`.
import type { Position, StaffPositions, StaffPositionsBody } from "../api/positions.ts";

/**
 * Access roles to show. `functionSlugs` = every function slug in the catalog (data, not a list here);
 * `retired` = roles being phased out (shown only to whoever still holds them); `held` = slugs held.
 */
export function accessRoleCatalog(
  catalog: readonly Position[],
  functionSlugs: readonly string[],
  retired: readonly string[],
  held: readonly string[],
): Position[] {
  return catalog.filter((p) => {
    const isJob = p.permissions === 0 && !p.fullAccess && functionSlugs.includes(p.slug);
    if (isJob) return false;
    return !retired.includes(p.slug) || held.includes(p.slug);
  });
}

/** Positions the person holds that the access-role picker does not show, as body entries. */
export function hiddenHeldPositions(held: StaffPositions, shown: readonly Position[]): StaffPositionsBody["positions"] {
  const shownSlugs = new Set(shown.map((p) => p.slug));
  return held.positions
    .filter((h) => !shownSlugs.has(h.position))
    .map((h) => (h.centerIds ? { position: h.position, centerIds: [...h.centerIds] } : { position: h.position }));
}

/**
 * The picker's body plus the hidden positions. When the picker holds nothing, the hidden `heldPrimary`
 * stays the primary (the BE refuses a primary that is not held).
 */
export function withHiddenPositions(
  body: StaffPositionsBody,
  hidden: StaffPositionsBody["positions"],
  heldPrimary?: string | null,
): StaffPositionsBody {
  const positions = [...body.positions, ...hidden];
  const primary = body.primary ?? (heldPrimary && hidden.some((h) => h.position === heldPrimary) ? heldPrimary : undefined);
  return primary ? { positions, primary } : { positions };
}
