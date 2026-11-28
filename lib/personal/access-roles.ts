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

/**
 * Roles being phased out, offered only to whoever still holds them: «Solo lectura» and «Facturación e
 * inventario» (cmr-be handoff §4), «Otro», and «Enfermería» / «Panel de enfermería», merged into «Clínico»
 * (owner, 28-nov; cmr-be feat/functions-drop-job-position).
 */
export const RETIRED_ACCESS_ROLES = ["read_only", "facturacion-inventario", "other", "nursing", "nursing_panel"] as const;

/** Whether the person's primary position is one the access-role picker does not show. */
export function primaryIsHidden(held: StaffPositions, shown: readonly Position[]): boolean {
  return !!held.primary && !shown.some((p) => p.slug === held.primary) && held.positions.some((h) => h.position === held.primary);
}

/** Positions the person holds that the access-role picker does not show, as body entries. */
export function hiddenHeldPositions(held: StaffPositions, shown: readonly Position[]): StaffPositionsBody["positions"] {
  const shownSlugs = new Set(shown.map((p) => p.slug));
  return held.positions
    .filter((h) => !shownSlugs.has(h.position))
    .map((h) => (h.centerIds ? { position: h.position, centerIds: [...h.centerIds] } : { position: h.position }));
}

/**
 * The picker's body plus the hidden positions. A primary that is a hidden job position (the label the
 * staff list shows, e.g. «Técnico») is kept while it is still held: the picker cannot offer it, so it
 * must not silently replace it with an access role.
 */
export function withHiddenPositions(
  body: StaffPositionsBody,
  hidden: StaffPositionsBody["positions"],
  heldPrimary?: string | null,
): StaffPositionsBody {
  const positions = [...body.positions, ...hidden];
  const keepHidden = !!heldPrimary && hidden.some((h) => h.position === heldPrimary);
  const primary = keepHidden ? heldPrimary : body.primary;
  return primary ? { positions, primary } : { positions };
}
