// A session row's flow and menu (components/frontdesk/fila-sesion.tsx, shared by the patient desk and the
// deprecated frontdesk), read by STAGE GROUP (piece 6b) under both definition shapes: a flow step is a
// board status (its `group` on 6b, its old slug mapped on 6a); a menu transition starts from groups
// (`fromGroups` on 6b, `fromStatuses` mapped on 6a). Door slugs (`presente`, `reactivar`…) stay: they are
// action names, not statuses.

import { slugOffered } from "../lifecycle/allowed-actions.ts"
import { statusGroup, transitionStartsFrom, type CatalogueTransition } from "../lifecycle/board-catalogue.ts"
import type { StageGroup } from "../lifecycle/stage-groups.ts"

/** The index of the flow step the session's group stands on, or -1 (before the flow, closed, unknown). */
export function flowStepIndex(
  flow: readonly { clave: string; group?: string | null }[],
  group: StageGroup | null,
): number {
  if (group === null) return -1
  return flow.findIndex((step) => statusGroup("therapy", { slug: step.clave, group: step.group }) === group)
}

/**
 * Whether a menu transition shows on a session: the row's `allowedActions` decide when it carries them
 * (the patient desk); without them (the deprecated frontdesk keeps its own rule) the transition must start
 * from the session's group and its permission must be held.
 */
export function sessionMenuOffered(
  tr: CatalogueTransition & { permissionSlug?: string | null },
  group: StageGroup | null,
  allowed: readonly string[] | null,
  can: (permission: string) => boolean,
): boolean {
  return (
    slugOffered(tr.slug, allowed) ??
    (transitionStartsFrom("therapy", tr, group) && (!tr.permissionSlug || can(tr.permissionSlug)))
  )
}
