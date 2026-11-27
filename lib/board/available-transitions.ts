// Which declared transitions a board row's action menu offers (components/tablero/tablero-acciones.tsx).
//
// Piece 6b: every lifecycle move is drawn from the row's `allowedActions` (stage, date rule and the
// per-center permission are already in it); the old rule by stored status, `fromStatuses` and the flat
// permission list is gone. The backend stamps the list on every board row since piece 4 (cmr-be
// `stamp-allowed-actions.ts`, on /board/rows and /frontdesk/tablero), so a row without it offers no
// lifecycle move. A transition that is not a lifecycle move (a board's own) is offered when its
// permission is held. Cancel on an arrived row is "not served": same transition, its own label.

import { slugOffered } from "../lifecycle/allowed-actions.ts"
import { cancelMeaningFromList, CANCEL_SLUG, NOT_SERVE_LABEL_KEY } from "../lifecycle/board-action-rules.ts"

export interface TransitionLite {
  slug: string
  labelKey: string
  fromStatuses: string[]
  permissionSlug: string | null
  sortOrder: number
  active?: boolean
}

/** Whether a slug names a lifecycle move (a door slug or an action key of the catalogue). */
const isLifecycleMove = (slug: string) => slugOffered(slug, []) !== null

export function availableTransitions<T extends TransitionLite>(
  transitions: readonly T[],
  row: {
    /** The row's `allowedActions`; null when the row does not carry them. */
    allowed: readonly string[] | null
    can: (permission: string) => boolean
  },
): T[] {
  const notServe = row.allowed !== null && cancelMeaningFromList(row.allowed) === "not_serve"
  return transitions
    .filter((tr) => tr.active !== false)
    .flatMap((tr): T[] => {
      if (!isLifecycleMove(tr.slug)) return !tr.permissionSlug || row.can(tr.permissionSlug) ? [tr] : []
      if (slugOffered(tr.slug, row.allowed) !== true) return []
      return [notServe && tr.slug === CANCEL_SLUG ? { ...tr, labelKey: NOT_SERVE_LABEL_KEY } : tr]
    })
    .sort((a, b) => a.sortOrder - b.sortOrder)
}
