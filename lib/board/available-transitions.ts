// Which declared transitions a board row's action menu offers (components/tablero/tablero-acciones.tsx).
//
// A row WITH `allowedActions` (cmr-be piece 4a): every lifecycle move is drawn from the list (stage, date
// rule and the per-center permission are already in it), so the stored status and the flat permission
// list are not consulted for those. A transition that is not a lifecycle move (a board's own) keeps the
// board's rule. A row WITHOUT the list (backend before 4a) keeps the status + permission rule, with Cancel
// and No-show narrowed by the piece-3 catalogue (lib/lifecycle/board-action-rules.ts `boardActionView`).
// Cancel on an arrived row is "not served": same transition, its own label.

import { slugOffered } from "../lifecycle/allowed-actions.ts"
import { boardActionView, cancelMeaning, CANCEL_SLUG, NOT_SERVE_LABEL_KEY } from "../lifecycle/board-action-rules.ts"

export interface TransitionLite {
  slug: string
  labelKey: string
  fromStatuses: string[]
  permissionSlug: string | null
  sortOrder: number
  active?: boolean
}

export function availableTransitions<T extends TransitionLite>(
  transitions: readonly T[],
  row: {
    status: string
    isTerminal: boolean
    allowed: readonly string[] | null
    can: (permission: string) => boolean
    /** The row's day and today (YYYY-MM-DD), for No-show on a row without the list. */
    date?: string | null
    today: string
  },
): T[] {
  const oldRule = (tr: T) =>
    (!tr.permissionSlug || row.can(tr.permissionSlug)) &&
    ((tr.fromStatuses ?? []).includes(row.status) || ((tr.fromStatuses?.length ?? 0) === 0 && !row.isTerminal))
  const notServe = row.allowed !== null && cancelMeaning(row.status, row.allowed) === "not_serve"
  return transitions
    .filter((tr) => tr.active !== false)
    .flatMap((tr): T[] => {
      const listed = slugOffered(tr.slug, row.allowed)
      if (listed === false) return []
      if (listed === true) return [notServe && tr.slug === CANCEL_SLUG ? { ...tr, labelKey: NOT_SERVE_LABEL_KEY } : tr]
      if (!oldRule(tr)) return []
      // No list (or a board's own slug): Cancel and No-show follow the piece-3 catalogue.
      const view = boardActionView(tr.slug, tr.labelKey, row.status, row.date, row.today)
      return view.visible ? [view.labelKey === tr.labelKey ? tr : { ...tr, labelKey: view.labelKey }] : []
    })
    .sort((a, b) => a.sortOrder - b.sortOrder)
}
