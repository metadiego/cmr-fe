// A row's `allowedActions` (cmr-be piece 4a): the lifecycle actions valid now from the row's stage and
// permitted to this user in the row's center. The backend is still the gate on the click; this list is
// what the screens draw. Hand-off: docs/specs/appointment-lifecycle-switch-fe.md, section 2.
//
// Deploy order: until 4a is in production the rows carry no list. A row WITHOUT the list keeps the
// screen's previous rule (functions answer `null` / `undefined`); a row WITH it (empty included) is
// drawn from it.

/** A catalogue action key (`lifecycle.action.<key>` is its label). */
export type ActionKey = string

/** The list on a row, or null when the row does not carry one. Non-string entries are dropped. */
export function readAllowedActions(row: unknown): ActionKey[] | null {
  const list = (row as { allowedActions?: unknown } | null | undefined)?.allowedActions
  if (!Array.isArray(list)) return null
  return list.filter((a): a is string => typeof a === "string")
}

// Board / REST slugs the screens still declare, and the action keys each one performs (both kinds:
// a row's list only ever holds its own kind's keys). Source: the slug table of
// docs/specs/appointment-actions-board.md, checked against cmr-be `actions/door-slugs.ts` (4a branch).
const SLUG_ACTIONS: Record<string, readonly ActionKey[]> = {
  confirmar: ["confirm"],
  volver_programada: ["unconfirm"],
  presente: ["check_in"],
  triage: ["start_triage"],
  consulta: ["start_consultation", "start_therapy"],
  atender: ["finish"],
  en_terapia: ["start_therapy"],
  asistido: ["finish"],
  desasistir: ["unattend"],
  desatender: ["undo_attendance"],
  volver_confirmada: ["undo_check_in"],
  quitar_presente: ["undo_check_in_clear_vitals"],
  quitar_presente_conservar_vitales: ["undo_check_in_keep_vitals"],
  volver_en_consulta: ["back_to_consultation"],
  volver_triage: ["back_to_triage"],
  volver_presente: ["back_to_waiting"],
  volver_pendiente: ["undo_check_in"],
  reactivar: ["reactivate"],
  no_show: ["no_show"],
  reagendar: ["reschedule"],
  cancelar: ["cancel", "not_serve"],
}

/** Every action key of the catalogue (both kinds): a slug that IS a key is checked as itself. */
const ACTION_KEYS = new Set<ActionKey>([
  "confirm", "unconfirm", "check_in", "undo_check_in", "undo_check_in_clear_vitals",
  "undo_check_in_keep_vitals", "start_triage", "start_consultation", "finish", "back_to_consultation",
  "back_to_triage", "back_to_waiting", "not_serve", "cancel", "no_show", "reschedule", "repair",
  "call", "uncall", "start_therapy", "unattend", "undo_attendance", "move", "reopen", "reactivate",
  "remove_entry_error",
])

/**
 * Whether a declared transition (by its slug or action key) is offered on a row: `true` / `false` from
 * the row's list, or `null` when the old rule decides (no list on the row, or a slug that is not a
 * lifecycle move, e.g. a board's own custom transition).
 */
export function slugOffered(slug: string, allowed: readonly ActionKey[] | null | undefined): boolean | null {
  if (!allowed) return null
  const actions = SLUG_ACTIONS[slug] ?? (ACTION_KEYS.has(slug) ? [slug] : null)
  if (!actions) return null
  return actions.some((a) => allowed.includes(a))
}

/**
 * What Cancel does on the row: a plain cancel, "arrived, not served" (same dialog and reason, its own
 * label), or nothing (`null`: hide it). `undefined` when the row has no list (old rule).
 */
export function cancelMeaning(allowed: readonly ActionKey[] | null | undefined): "cancel" | "not_serve" | null | undefined {
  if (!allowed) return undefined
  if (allowed.includes("not_serve")) return "not_serve"
  if (allowed.includes("cancel")) return "cancel"
  return null
}

/** The confirmation move the row offers now, if any. */
export function confirmToggle(allowed: readonly ActionKey[] | null | undefined): "confirm" | "unconfirm" | null {
  if (allowed?.includes("confirm")) return "confirm"
  if (allowed?.includes("unconfirm")) return "unconfirm"
  return null
}

/** Label key of an action. */
export const actionLabelKey = (key: ActionKey) => `lifecycle.action.${key}`

/**
 * The backend refused because the row is not where this screen thinks it is (the action no longer
 * applies, or someone else moved it a moment ago): the screen refetches the row so its buttons redraw.
 * The toast still shows; nothing is retried.
 */
export function refusalRefreshesRow(err: unknown): boolean {
  const code = (err as { code?: unknown } | null)?.code
  return code === "LIFECYCLE_ACTION_NOT_ALLOWED" || code === "LIFECYCLE_STALE"
}
