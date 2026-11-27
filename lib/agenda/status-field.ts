// The appointment form's status field (components/agenda/cita-modal-fields.tsx): labels from
// lifecycle.label.medical.*, colours from the consultation board's statuses (frontdesk_consultation, the
// catalogue /appointments/statuses used to serve), found by stage group under both definition shapes.

import { statusOfGroup, type CatalogueStatus } from "../lifecycle/board-catalogue.ts"
import { rowGroup, type StagedRow } from "../lifecycle/stage-groups.ts"
import { stageLabel, stageLabelKey } from "../lifecycle/stage-labels.ts"

type Status = CatalogueStatus & { color?: string | null }

const colourOf = (statuses: readonly Status[], group: Parameters<typeof statusOfGroup>[2]) =>
  statusOfGroup("medical", statuses, group)?.color ?? null

/** The create toggle's two options: born booked or confirmed, with the catalogue's dot colours. */
export function statusOptions(statuses: readonly Status[]) {
  return (["booked", "confirmed"] as const).map((value) => ({
    value,
    labelKey: stageLabelKey("medical", value),
    dot: colourOf(statuses, value) ?? undefined,
  }))
}

/**
 * The read-only badge: the appointment's stage label tinted with its group's catalogue colour; with no
 * appointment (create without the confirm permission) it reads booked. A status the mapping does not
 * know gives no label (the form shows its «Agendada» fallback) and no colour.
 */
export function statusBadge(
  statuses: readonly Status[],
  row: StagedRow | null,
): { labelKey: string | null; color: string | null } {
  if (!row) return { labelKey: stageLabelKey("medical", "booked"), color: colourOf(statuses, "booked") }
  const label = stageLabel("medical", row)
  if (!label) return { labelKey: null, color: null }
  return { labelKey: stageLabelKey("medical", label), color: colourOf(statuses, rowGroup("medical", row)) }
}
