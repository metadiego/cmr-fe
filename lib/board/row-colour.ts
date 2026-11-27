// The colour of a board row's left edge (components/agenda/tablero-dinamico.tsx): the colour of the
// board status the row is in, found by the row's STAGE GROUP (lib/lifecycle/board-catalogue.ts), never by
// its old word. A board of another entity matches the raw status.

import { rowStatus, statusOfGroup } from "../lifecycle/board-catalogue.ts"
import type { AppointmentKind, StagedRow, StageGroup } from "../lifecycle/stage-groups.ts"

/** A board status as the board table gets it (`group` only from the 6b backend). */
export type EstadoLite = { clave: string; orden: number; color?: string | null; group?: string | null }

/** The board status a row is in, from the lite list. */
export function rowEstado<E extends EstadoLite>(
  kind: AppointmentKind | null,
  estados: readonly E[],
  row: { estado?: unknown } & Record<string, unknown>,
): E | undefined {
  if (!kind) return estados.find((e) => e.clave === String(row.estado ?? ""))
  const withSlug = estados.map((e) => ({ slug: e.clave, group: e.group, e }))
  return rowStatus(kind, withSlug, row as StagedRow)?.e
}

/** The board status of a stage group, from the lite list (e.g. a flow step's colour). */
export function estadoOfGroup<E extends EstadoLite>(
  kind: AppointmentKind,
  estados: readonly E[],
  group: StageGroup | null,
): E | undefined {
  return statusOfGroup(kind, estados.map((e) => ({ slug: e.clave, group: e.group, e })), group)?.e
}

export function rowColour(
  kind: AppointmentKind | null,
  estados: readonly EstadoLite[],
  row: { estado?: unknown } & Record<string, unknown>,
): string | null {
  return rowEstado(kind, estados, row)?.color ?? null
}
