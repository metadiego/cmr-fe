/**
 * The care-flow steps of a therapy board (the patient desk's per-service table), read by stage group.
 *
 * A step is a board status whose stage group is one the session stamps a time for (arrival, therapy
 * start, attended) and that a transition leads into. The group comes from the definition (`group` on
 * 6b) or from the status's old word (6a): see ../lifecycle/board-catalogue.ts. The step keeps the
 * status slug as its key, since the row component reads stamps and actions by it.
 */

import {
  statusGroup,
  transitionToGroup,
  type CatalogueStatus,
  type CatalogueTransition,
} from "../lifecycle/board-catalogue.ts"
import type { StageGroup } from "../lifecycle/stage-groups.ts"

/** The groups a session stamps a time for, in flow order, and the stamp each one carries. */
export const STAMPED_GROUPS = {
  waiting: "presentAt",
  in_therapy: "therapyStartedAt",
  done: "attendedAt",
} as const satisfies Partial<Record<StageGroup, string>>

const isStamped = (g: StageGroup | null): g is keyof typeof STAMPED_GROUPS =>
  g !== null && g in STAMPED_GROUPS

/** The board's statuses that are care-flow steps, in the board's order. */
export function sessionSteps<S extends CatalogueStatus>(
  statuses: readonly S[],
  transitions: readonly CatalogueTransition[],
): S[] {
  const targets = new Set(transitions.map((tr) => transitionToGroup("therapy", tr)))
  return statuses.filter((s) => {
    const group = statusGroup("therapy", s)
    return isStamped(group) && targets.has(group)
  })
}

/** Slugs of the steps drawn nowhere in the row: the arrival is one per patient, in the header. */
export function hiddenStepSlugs(steps: readonly CatalogueStatus[]): Set<string> {
  return new Set(steps.filter((s) => statusGroup("therapy", s) === "waiting").map((s) => s.slug))
}
