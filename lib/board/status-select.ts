// The inline status selector of a board row (components/tablero/estado-select.tsx, the call center's day
// sheet). Read by STAGE GROUP (piece 6b): the row sits in the board status of its group; picking another
// status runs the transition that lands in that status's group from the row's group. With the row's
// `allowedActions` (when the row carries them) a move the backend leaves out is not run. A row whose
// group has no status on this board is locked and shows its stage label (not served reads as such).

import { slugOffered } from "../lifecycle/allowed-actions.ts"
import {
  rowStatus,
  statusGroup,
  transitionStartsFrom,
  transitionToGroup,
  type CatalogueStatus,
  type CatalogueTransition,
} from "../lifecycle/board-catalogue.ts"
import { rowGroup, type AppointmentKind, type StagedRow } from "../lifecycle/stage-groups.ts"
import { stageLabel, type StageLabel } from "../lifecycle/stage-labels.ts"

export function statusSelect<S extends CatalogueStatus, T extends CatalogueTransition>(
  kind: AppointmentKind,
  statuses: readonly S[],
  transitions: readonly T[],
  row: StagedRow,
  allowed: readonly string[] | null,
): {
  /** The board status the row is in; undefined = this board does not manage it (locked). */
  current: S | undefined
  /** The row's stage label (for the locked view), null when the row has no known status. */
  label: StageLabel | null
  /** The transition that takes the row to `target`, if one applies now. */
  transitionTo: (target: S) => T | undefined
} {
  const group = rowGroup(kind, row)
  const current = rowStatus(kind, statuses, row)
  return {
    current,
    label: stageLabel(kind, row),
    transitionTo: (target) => {
      const to = statusGroup(kind, target)
      if (to === null || to === group) return undefined
      return transitions.find(
        (t) =>
          transitionToGroup(kind, t) === to &&
          transitionStartsFrom(kind, t, group) &&
          slugOffered(t.slug, allowed) !== false,
      )
    },
  }
}
