/**
 * The board definition (GET /board/definition) read by stage group (appointment lifecycle, piece 6b).
 *
 * Two backends serve the definition while release 6b rolls out, and every screen must read both:
 * - 6a: statuses and transitions name OLD words only (`slug`, `fromStatuses`, `toStatus`).
 * - 6b: the same old words, plus the stage group of each (`group` on a status, `fromGroups` / `toGroup`
 *   on a transition).
 * A group field wins when present; otherwise the old word is mapped to its group here (the dictionary of
 * ./stage-groups.ts). Screens compare a row's group (`rowGroup`) with these, never `row.estado` with a slug.
 */

import {
  MEDICAL_GROUPS,
  THERAPY_GROUPS,
  rowGroup,
  stagesOf,
  type AppointmentKind,
  type StagedRow,
  type StageGroup,
} from "./stage-groups.ts"

/** A definition status, as both backends serve it (`group` only from 6b on). */
export interface CatalogueStatus {
  slug: string
  group?: string | null
}

/** A definition transition, as both backends serve it (`fromGroups` / `toGroup` only from 6b on). */
export interface CatalogueTransition {
  slug: string
  fromStatuses?: readonly string[] | null
  toStatus?: string | null
  fromGroups?: readonly string[] | null
  toGroup?: string | null
}

/** The lifecycle kind of a board's entity: `cita` boards hold medical rows, `sesion` boards therapy rows. */
export function boardKind(entity: string | null | undefined): AppointmentKind | null {
  if (entity === "cita") return "medical"
  if (entity === "sesion") return "therapy"
  return null
}

const KIND_GROUPS: Readonly<Record<AppointmentKind, readonly StageGroup[]>> = {
  medical: MEDICAL_GROUPS,
  therapy: THERAPY_GROUPS,
}

/** A served group name, when it is a group of the kind (anything else is ignored). */
export function asGroup(kind: AppointmentKind, value: unknown): StageGroup | null {
  return typeof value === "string" && KIND_GROUPS[kind].includes(value as StageGroup) ? (value as StageGroup) : null
}

/** The group an old status word names (a definition slug, a stored preference, a history diff). */
export function oldWordGroup(kind: AppointmentKind, word: string | null | undefined): StageGroup | null {
  return word ? rowGroup(kind, { estado: word }) : null
}

/** The group of a definition status: its `group` (6b), else the group of its old-word slug (6a). */
export function statusGroup(kind: AppointmentKind, status: CatalogueStatus): StageGroup | null {
  return asGroup(kind, status.group) ?? oldWordGroup(kind, status.slug)
}

const present = <T>(x: T | null): x is T => x !== null

/** The groups a transition starts from (empty = from any group): `fromGroups` (6b), else `fromStatuses`. */
export function transitionFromGroups(kind: AppointmentKind, tr: CatalogueTransition): StageGroup[] {
  if (Array.isArray(tr.fromGroups)) return tr.fromGroups.map((g) => asGroup(kind, g)).filter(present)
  return (tr.fromStatuses ?? []).map((w) => oldWordGroup(kind, w)).filter(present)
}

/** The group a transition lands in (null = the backend decides): `toGroup` (6b), else `toStatus`. */
export function transitionToGroup(kind: AppointmentKind, tr: CatalogueTransition): StageGroup | null {
  return asGroup(kind, tr.toGroup) ?? oldWordGroup(kind, tr.toStatus)
}

/** Whether a transition starts from the row's group (a transition from any group always does). */
export function transitionStartsFrom(kind: AppointmentKind, tr: CatalogueTransition, group: StageGroup | null): boolean {
  const from = transitionFromGroups(kind, tr)
  return from.length === 0 || (group !== null && from.includes(group))
}

/** The board's status of a group, if the board has one. */
export function statusOfGroup<S extends CatalogueStatus>(
  kind: AppointmentKind,
  statuses: readonly S[],
  group: StageGroup | null,
): S | undefined {
  return group === null ? undefined : statuses.find((s) => statusGroup(kind, s) === group)
}

/** The board's status a row is in, by the row's stage group (its stored stages, or its old value). */
export function rowStatus<S extends CatalogueStatus>(
  kind: AppointmentKind,
  statuses: readonly S[],
  row: StagedRow,
): S | undefined {
  return statusOfGroup(kind, statuses, rowGroup(kind, row))
}

/**
 * A stored status choice (the staff tab preference, a column's `requiereEstado`): an old word today, a
 * group name accepted too. Mapped on read to the board's status; the stored value is never rewritten.
 */
export function storedStatus<S extends CatalogueStatus>(
  kind: AppointmentKind,
  statuses: readonly S[],
  stored: string | null | undefined,
): S | undefined {
  if (!stored) return undefined
  return statuses.find((s) => s.slug === stored) ?? statusOfGroup(kind, statuses, asGroup(kind, stored))
}

/**
 * Progress along the care flow, per kind: how far a row got. A row closed after arriving (not served)
 * reached the waiting room and no further; a row closed before (cancelled, no-show, rescheduled) reached
 * nothing. A group off the flow has no rank (-1).
 */
const FLOW: Readonly<Record<AppointmentKind, readonly StageGroup[]>> = {
  medical: ["booked", "confirmed", "waiting", "triage", "in_consultation", "done"],
  therapy: ["upcoming", "waiting", "in_therapy", "done"],
}

/** The rank of a group on the kind's care flow, or -1 when the group is not a step of it. */
export function flowRank(kind: AppointmentKind, group: StageGroup | null): number {
  return group === null ? -1 : FLOW[kind].indexOf(group)
}

/** How far a row got on the care flow (see FLOW): a not-served row counts as arrived. */
export function rowReach(kind: AppointmentKind, row: StagedRow): number {
  const stages = stagesOf(kind, row)
  if (stages?.care === "not_served") return flowRank(kind, "waiting")
  return flowRank(kind, rowGroup(kind, row))
}
