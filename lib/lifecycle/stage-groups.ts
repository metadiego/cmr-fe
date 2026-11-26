/**
 * Stage groups, the frontend copy of the backend's `appointment-lifecycle/readers/stage-groups.ts`
 * (same names, same table). Readers name groups, never old status values: a reader moved onto the
 * stage columns (`bookingStatus` / `careStatus`) keeps the rows the old `estado` / `status` check
 * kept, by construction (`stage-groups.test.ts` proves it).
 *
 * The old Spanish values appear ONLY in this folder (the copy of the backend mapping below). They go
 * away with the old column (piece 6). See docs/specs/appointment-lifecycle-5-fe.md.
 */

export type AppointmentKind = "medical" | "therapy"

export type BookingStatus =
  | "booked"
  | "confirmed"
  | "arrived"
  | "cancelled"
  | "no_show"
  | "rescheduled"
export type CareStatus =
  | "waiting"
  | "triage"
  | "in_consultation"
  | "done"
  | "not_served"
  | "called"
  | "in_therapy"

export interface Stages {
  booking: BookingStatus
  care: CareStatus | null
}

export type StageGroup =
  | "booked"
  | "confirmed"
  | "upcoming"
  | "waiting"
  | "triage"
  | "in_consultation"
  | "in_therapy"
  | "done"
  | "no_show"
  | "cancelled_or_not_served"
  | "rescheduled"

const s = (booking: BookingStatus, care: CareStatus | null = null): Stages =>
  Object.freeze({ booking, care })

/**
 * The stages of each group, per kind. A group with no stages does not exist for that kind.
 * Arrived / not_served sits with cancelled for both kinds (stored as the same old value, told apart
 * only by the arrival stamp).
 */
const GROUP_STAGES: Readonly<
  Record<AppointmentKind, Readonly<Record<StageGroup, readonly Stages[]>>>
> = {
  medical: {
    booked: [s("booked")],
    confirmed: [s("confirmed")],
    upcoming: [],
    waiting: [s("arrived", "waiting")],
    triage: [s("arrived", "triage")],
    in_consultation: [s("arrived", "in_consultation")],
    in_therapy: [],
    done: [s("arrived", "done")],
    no_show: [s("no_show")],
    cancelled_or_not_served: [s("cancelled"), s("arrived", "not_served")],
    rescheduled: [s("rescheduled")],
  },
  therapy: {
    booked: [],
    confirmed: [],
    upcoming: [s("booked"), s("confirmed")],
    waiting: [s("arrived", "waiting"), s("arrived", "called")],
    triage: [],
    in_consultation: [],
    in_therapy: [s("arrived", "in_therapy")],
    done: [s("arrived", "done")],
    no_show: [],
    cancelled_or_not_served: [s("cancelled"), s("arrived", "not_served")],
    rescheduled: [],
  },
}

const groupsOfKind = (kind: AppointmentKind): readonly StageGroup[] =>
  Object.freeze(
    (Object.keys(GROUP_STAGES[kind]) as StageGroup[]).filter(
      (g) => GROUP_STAGES[kind][g].length > 0
    )
  )

/** The 9 medical groups. */
export const MEDICAL_GROUPS: readonly StageGroup[] = groupsOfKind("medical")
/** The 5 therapy groups. */
export const THERAPY_GROUPS: readonly StageGroup[] = groupsOfKind("therapy")

const GROUPS: Readonly<Record<AppointmentKind, readonly StageGroup[]>> = {
  medical: MEDICAL_GROUPS,
  therapy: THERAPY_GROUPS,
}

type ByKind = Readonly<Record<AppointmentKind, readonly StageGroup[]>>

/* Named unions readers share: defined once here, never rebuilt in a reader. */

/** Rows not yet finished, cancelled or moved. */
export const LIVE: ByKind = {
  medical: ["booked", "confirmed", "waiting", "triage", "in_consultation"],
  therapy: ["upcoming", "waiting", "in_therapy"],
}

/** The patient is here and being looked after (or waiting for it). */
export const IN_CARE: ByKind = {
  medical: ["waiting", "triage", "in_consultation"],
  therapy: ["waiting", "in_therapy"],
}

/** The patient came: in care or done. Not served is not here. */
export const SHOWED_UP: ByKind = {
  medical: [...IN_CARE.medical, "done"],
  therapy: [...IN_CARE.therapy, "done"],
}

/** Booked and not yet arrived. */
export const BEFORE_ARRIVAL: ByKind = {
  medical: ["booked", "confirmed"],
  therapy: ["upcoming"],
}

/**
 * Medical only: the rows that do not take the patient's day (no-show, cancelled or not served,
 * rescheduled). Not the same as "not live": `done` is not live and DOES take the day.
 */
export const NOT_OCCUPYING_THE_DAY: readonly StageGroup[] = [
  "no_show",
  "cancelled_or_not_served",
  "rescheduled",
]

/** Medical only: closed without the patient being seen (no-show, cancelled or not served). */
export const NEVER_SEEN: readonly StageGroup[] = [
  "no_show",
  "cancelled_or_not_served",
]

function stagesInGroupOrThrow(
  kind: AppointmentKind,
  group: StageGroup
): readonly Stages[] {
  if (!GROUPS[kind].includes(group))
    throw new Error(`${kind} has no stage group ${group}`)
  return GROUP_STAGES[kind][group]
}

/** The kind's groups minus the given ones, in table order: the named complement of a set. */
export function groupsExcept(
  kind: AppointmentKind,
  groups: readonly StageGroup[]
): StageGroup[] {
  for (const group of groups) stagesInGroupOrThrow(kind, group) // a group of the other kind is a bug
  return GROUPS[kind].filter((group) => !groups.includes(group))
}

/** The rows the citas list shows by default: medical all but `rescheduled`; therapy every group. */
export const SHOWN_IN_LIST: ByKind = {
  medical: groupsExcept("medical", ["rescheduled"]),
  therapy: groupsExcept("therapy", []),
}

/** Not cancelled: therapy every group but cancelled (or not served); medical also without rescheduled. */
export const NOT_CANCELLED: ByKind = {
  medical: groupsExcept("medical", ["cancelled_or_not_served", "rescheduled"]),
  therapy: groupsExcept("therapy", ["cancelled_or_not_served"]),
}

/** The stages of a group. Throws for a group the kind does not have. */
export function stagesInGroup(
  kind: AppointmentKind,
  group: StageGroup
): Stages[] {
  return [...stagesInGroupOrThrow(kind, group)]
}

function findGroup(
  kind: AppointmentKind,
  stages: Stages
): StageGroup | undefined {
  return GROUPS[kind].find((g) =>
    GROUP_STAGES[kind][g].some(
      (x) => x.booking === stages.booking && x.care === stages.care
    )
  )
}

/** The group a stage belongs to. Throws for a stage the kind does not have. */
export function groupOf(kind: AppointmentKind, stages: Stages): StageGroup {
  const group = findGroup(kind, stages)
  if (group === undefined)
    throw new Error(
      `${kind} has no stage ${stages.booking}/${stages.care ?? "-"}`
    )
  return group
}

/** Whether the stages fall in any of the groups. A row with no stages is in none. */
export function inGroups(
  kind: AppointmentKind,
  stages: Stages | null,
  groups: readonly StageGroup[]
): boolean {
  for (const group of groups) stagesInGroupOrThrow(kind, group) // a group of the other kind is a bug
  if (stages === null) return false
  return groups.includes(groupOf(kind, stages))
}

/* ---- Stages of a row ---------------------------------------------------------------------- */

/**
 * A row as a reader sees it: a `CitaEntity` (medical, old value in `estado`) or a
 * `FrontdeskSesionEntity` (therapy, old value in `status`), or a partial of them. A field the row
 * does not carry is simply absent.
 */
export interface StagedRow {
  estado?: string | null
  status?: string | null
  bookingStatus?: BookingStatus | null
  careStatus?: CareStatus | null
  syncedStatus?: string | null
  confirmedAt?: string | Date | null
  calledAt?: string | Date | null
  /** Arrival stamp of a medical row. */
  arrivedAt?: string | Date | null
  /** Arrival stamp of a therapy row. */
  presentAt?: string | Date | null
}

// Copy of the backend mapping old value -> stages (`appointment-lifecycle/stages.ts`).
const NOT_SERVED: Stages = s("arrived", "not_served")

const MEDICAL_STATUS_STAGES: Readonly<Record<string, Stages>> = {
  programada: s("booked"),
  confirmada: s("confirmed"),
  presente: s("arrived", "waiting"),
  triage: s("arrived", "triage"),
  en_consulta: s("arrived", "in_consultation"),
  atendida: s("arrived", "done"),
  no_show: s("no_show"),
  cancelada: s("cancelled"), // with an arrival stamp: arrived / not_served
  reprogramada: s("rescheduled"),
}

const THERAPY_STATUS_STAGES: Readonly<
  Record<string, (row: StagedRow) => Stages>
> = {
  pendiente: (row) => (row.confirmedAt ? s("confirmed") : s("booked")),
  presente: (row) =>
    row.calledAt ? s("arrived", "called") : s("arrived", "waiting"),
  en_terapia: () => s("arrived", "in_therapy"),
  asistido: () => s("arrived", "done"),
  cancelada: (row) => (row.presentAt ? NOT_SERVED : s("cancelled")),
}

/** The old value a row carries: `estado` (appointments) or `status` (sessions). */
function oldStatusOf(row: StagedRow): string | null {
  const old = row.estado ?? row.status
  return typeof old === "string" ? old : null
}

function deriveStages(kind: AppointmentKind, row: StagedRow): Stages | null {
  const old = oldStatusOf(row)
  if (old === null) return null
  if (kind === "medical") {
    if (!Object.hasOwn(MEDICAL_STATUS_STAGES, old)) return null
    return old === "cancelada" && row.arrivedAt
      ? NOT_SERVED
      : MEDICAL_STATUS_STAGES[old]
  }
  return Object.hasOwn(THERAPY_STATUS_STAGES, old)
    ? THERAPY_STATUS_STAGES[old](row)
    : null
}

/**
 * The stages a reader should judge a row by. The stored `bookingStatus` / `careStatus` are trusted
 * when `bookingStatus` is present and the row is not known to be stale (the response carries no `syncedStatus` key,
 * or `syncedStatus` equals its old status) and the pair is a stage of the kind. Otherwise they are
 * derived from the old value (and its stamps), so a row a bypassing writer just changed, or one with
 * no stage yet, is never judged stale. Null for a status the mapping does not know.
 */
export function stagesOf(kind: AppointmentKind, row: StagedRow): Stages | null {
  const old = oldStatusOf(row)
  const synced = !("syncedStatus" in row) || row.syncedStatus === old
  if (row.bookingStatus && synced) {
    const stored: Stages = {
      booking: row.bookingStatus,
      care: row.careStatus ?? null,
    }
    if (findGroup(kind, stored) !== undefined) return stored
  }
  return deriveStages(kind, row)
}

/** The group a row is in, or null for a status the mapping does not know (or no status at all). */
export function rowGroup(
  kind: AppointmentKind,
  row: StagedRow
): StageGroup | null {
  const stages = stagesOf(kind, row)
  return stages ? groupOf(kind, stages) : null
}

/**
 * Whether a group kept from `rowGroup` is one of the list. A null group (unknown status) is in none.
 * With the row at hand, `rowInGroups` says the same in one call; this is for a stored group.
 */
export function groupIn(
  kind: AppointmentKind,
  group: StageGroup | null,
  groups: readonly StageGroup[]
): boolean {
  for (const g of groups) stagesInGroupOrThrow(kind, g) // a group of the other kind is a bug
  return group !== null && groups.includes(group)
}

/**
 * Whether a row is in any of the groups: by its stored stages when synced, else derived from its old
 * value. False for a status the mapping does not know.
 */
export function rowInGroups(
  kind: AppointmentKind,
  row: StagedRow,
  groups: readonly StageGroup[]
): boolean {
  return inGroups(kind, stagesOf(kind, row), groups)
}

/**
 * The old negative read `estado !== "cancelada"`: true unless the row is cancelled or not served, or
 * in one of `alsoOff` (other groups that site left out, e.g. `rescheduled`). A status the mapping
 * does not know stays IN, as the old read kept it; the positive `NOT_CANCELLED` list would drop it.
 */
export function isNotCancelled(
  kind: AppointmentKind,
  row: StagedRow,
  alsoOff: readonly StageGroup[] = []
): boolean {
  return !rowInGroups(kind, row, ["cancelled_or_not_served", ...alsoOff])
}

/** The stage fields and stamps a session entity (`FrontdeskSesionEntity`) carries. */
export type SessionStageFields = Pick<
  StagedRow,
  | "bookingStatus"
  | "careStatus"
  | "syncedStatus"
  | "confirmedAt"
  | "calledAt"
  | "presentAt"
>

/** A session's stage fields, to carry next to its status into a reader's row shape. */
export function sessionStageFields(s: SessionStageFields): SessionStageFields {
  return {
    bookingStatus: s.bookingStatus,
    careStatus: s.careStatus,
    syncedStatus: s.syncedStatus,
    confirmedAt: s.confirmedAt,
    calledAt: s.calledAt,
    presentAt: s.presentAt,
  }
}
