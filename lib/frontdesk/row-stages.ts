// Frontdesk / patient-desk rows as staged rows (appointment lifecycle, piece 5d). Readers decide by
// group (lib/lifecycle/stage-groups.ts: rowGroup, groupIn, rowInGroups), never by the old status word.
// Board rows (/board/rows, /frontdesk/tablero) carry only the old status and its stamps, so their stages
// are derived; a session entity (FrontdeskSesionEntity) adds its stored stages, trusted while synced.

import { sessionStageFields, type SessionStageFields, type StagedRow } from "../lifecycle/stage-groups.ts"

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
  return { status: rowStatus, ...sessionStageFields(session ?? {}), syncedStatus: session?.syncedStatus ?? null }
}

const str = (v: unknown) => (typeof v === "string" ? v : v == null ? "" : String(v))

/** A consultation board row (Spanish keys: `estado`, arrival stamp under `presente`) as a staged row. */
export function consultationRowStaged(row: { estado?: unknown; presente?: unknown }): StagedRow {
  return { estado: str(row.estado), arrivedAt: str(row.presente) || null }
}
