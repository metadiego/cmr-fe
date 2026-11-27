// The status chips above a board (components/tablero/generic-board.tsx): one per board status with rows
// in it (or selected), counted by the row's STAGE GROUP, never by matching the row's old word with the
// status slug. A row is in the status whose group is its group (lib/lifecycle/board-catalogue.ts), under
// both definition shapes (6a: old words; 6b: old words plus `group`). A board of another entity (no
// lifecycle kind) still counts by the row's raw status.

import { rowStatus, type CatalogueStatus } from "../lifecycle/board-catalogue.ts"
import type { AppointmentKind, StagedRow } from "../lifecycle/stage-groups.ts"

type Row = { estado?: unknown } & Record<string, unknown>

/** The board status slug a row is counted under ("" when none). */
export function rowStatusSlug(kind: AppointmentKind | null, statuses: readonly CatalogueStatus[], row: Row): string {
  const raw = typeof row.estado === "string" ? row.estado : ""
  if (!kind) return raw
  return rowStatus(kind, statuses, row as StagedRow)?.slug ?? raw
}

export function kpiChips<S extends CatalogueStatus, R extends Row>(
  kind: AppointmentKind | null,
  statuses: readonly S[],
  rows: readonly R[],
  selected: string,
): { counts: Map<string, number>; chips: S[]; filtered: R[] } {
  const counts = new Map<string, number>()
  const slugs = rows.map((r) => rowStatusSlug(kind, statuses, r))
  for (const slug of slugs) counts.set(slug, (counts.get(slug) ?? 0) + 1)
  // The selected chip shows even with 0 rows: a person who opens "on Presente" sees that tab active.
  const chips = statuses.filter((s) => (counts.get(s.slug) ?? 0) > 0 || s.slug === selected)
  const filtered = selected ? rows.filter((_, i) => slugs[i] === selected) : [...rows]
  return { counts, chips, filtered }
}
