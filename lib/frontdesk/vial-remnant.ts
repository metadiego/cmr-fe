// Split vials (cmr-be #700, owner 24-nov-2026: Plaquex 50 mg shared across visits). Pure rules for the
// patient-desk row of a service whose `sessionUnit` is 'vial'.

import { rowInGroups, type StagedRow } from "../lifecycle/stage-groups.ts";

/** An attended (done) visit that used the patient's remnant (quantity 0) spends no session: no number. */
export function isRemnantVisit(
  session: (StagedRow & { quantity?: number | null }) | null | undefined,
  sessionUnit: string | null | undefined,
): boolean {
  return (
    sessionUnit === "vial" &&
    !!session &&
    rowInGroups("therapy", session, ["done"]) &&
    session.quantity === 0
  );
}

/** The remnants worth a chip for one product (or all when none given): usable first, then expired; empty ones never. */
export function remnantsToShow<T extends { productId: string; remaining: number; expired: boolean }>(
  vials: readonly T[],
  productId?: string | null,
): T[] {
  return vials
    .filter((v) => v.remaining > 0 && (!productId || v.productId === productId))
    .sort((a, b) => Number(a.expired) - Number(b.expired));
}
