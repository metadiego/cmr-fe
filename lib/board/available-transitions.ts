// Which declared transitions a board row's action menu offers (components/tablero/tablero-acciones.tsx).
//
// A row WITH `allowedActions` (cmr-be piece 4a): every lifecycle move is drawn from the list (stage, date
// rule and the per-center permission are already in it), so the stored status and the flat permission
// list are not consulted for those. A transition that is not a lifecycle move (a board's own) keeps the
// board's rule. A row WITHOUT the list (backend before 4a) keeps today's rule for everything.
// Cancel on an arrived row is "not served": same transition, its own label.

import { cancelMeaning, slugOffered } from "../lifecycle/allowed-actions.ts"

export interface TransitionLite {
  slug: string
  labelKey: string
  fromStatuses: string[]
  permissionSlug: string | null
  sortOrder: number
  active?: boolean
}

export const NOT_SERVE_LABEL_KEY = "lifecycle.action.not_serve"
const CANCEL_SLUG = "cancelar"

export function availableTransitions<T extends TransitionLite>(
  transitions: readonly T[],
  row: { status: string; isTerminal: boolean; allowed: readonly string[] | null; can: (permission: string) => boolean },
): T[] {
  const oldRule = (tr: T) =>
    (!tr.permissionSlug || row.can(tr.permissionSlug)) &&
    ((tr.fromStatuses ?? []).includes(row.status) || ((tr.fromStatuses?.length ?? 0) === 0 && !row.isTerminal))
  const notServe = cancelMeaning(row.allowed) === "not_serve"
  return transitions
    .filter((tr) => tr.active !== false)
    .filter((tr) => slugOffered(tr.slug, row.allowed) ?? oldRule(tr))
    .map((tr) => (notServe && tr.slug === CANCEL_SLUG ? { ...tr, labelKey: NOT_SERVE_LABEL_KEY } : tr))
    .sort((a, b) => a.sortOrder - b.sortOrder)
}
