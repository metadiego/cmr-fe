// The stage group of a frontdesk / patient-desk row (appointment lifecycle, piece 5d). Readers here
// decide by group (lib/lifecycle/stage-groups.ts), never by the old status word. Board rows
// (/board/rows, /frontdesk/tablero) carry only the old status and its stamps, so their stages are
// derived; a session entity (FrontdeskSesionEntity) adds its stored stages, trusted while synced.

import {
  groupOf,
  stagesOf,
  type AppointmentKind,
  type StagedRow,
  type StageGroup,
} from "../lifecycle/stage-groups.ts"

/** The group a row is in, or null for a status the mapping does not know (or no status at all). */
export function rowGroup(kind: AppointmentKind, row: StagedRow): StageGroup | null {
  const stages = stagesOf(kind, row)
  return stages ? groupOf(kind, stages) : null
}

/** Whether a group is one of the list. A null group (unknown status) is in none. */
export function groupIn(group: StageGroup | null, groups: readonly StageGroup[]): boolean {
  return group !== null && groups.includes(group)
}

/** The stage fields of a session entity a board row can borrow. */
export type SessionStageFields = Pick<
  StagedRow,
  "bookingStatus" | "careStatus" | "syncedStatus" | "confirmedAt" | "calledAt" | "presentAt"
>

/**
 * A service-board row as a staged row: the row's own status (the fresh truth, PR #195) plus its
 * session's stages and stamps. The session map can lag behind the row (SSE), so its stored stages count
 * only while they were synced from that same status (`syncedStatus` is always set here, so a missing
 * one means "derive").
 */
export function sessionRowStaged(
  rowStatus: string,
  session: SessionStageFields | null | undefined
): StagedRow {
  return {
    status: rowStatus,
    bookingStatus: session?.bookingStatus ?? null,
    careStatus: session?.careStatus ?? null,
    syncedStatus: session?.syncedStatus ?? null,
    confirmedAt: session?.confirmedAt ?? null,
    calledAt: session?.calledAt ?? null,
    presentAt: session?.presentAt ?? null,
  }
}

const str = (v: unknown) => (typeof v === "string" ? v : v == null ? "" : String(v))

/** A consultation board row (Spanish keys: `estado`, arrival stamp under `presente`) as a staged row. */
export function consultationRowStaged(row: { estado?: unknown; presente?: unknown }): StagedRow {
  return { estado: str(row.estado), arrivedAt: str(row.presente) || null }
}
