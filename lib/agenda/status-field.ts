// The appointment form's status field (components/agenda/cita-modal-fields.tsx): labels from
// lifecycle.label.medical.*, colours from a board's statuses found by stage group under both definition
// shapes: the call center board (citas_cc, needs appointments.read) for the create toggle, the consultation
// board (frontdesk_consultation, needs frontdesk.read) for the edit badge, with citas_cc as its fallback.

import { statusOfGroup, type CatalogueStatus } from "../lifecycle/board-catalogue.ts"
import { rowGroup, type StagedRow } from "../lifecycle/stage-groups.ts"
import { stageLabel, stageLabelKey } from "../lifecycle/stage-labels.ts"

type Status = CatalogueStatus & { color?: string | null }

const colourOf = (statuses: readonly Status[], group: Parameters<typeof statusOfGroup>[2]) =>
  statusOfGroup("medical", statuses, group)?.color ?? null

/**
 * The statuses that give the colours. Create reads the call center board's; edit reads the consultation
 * board's, falling back to the call center's when that one failed to load (or came back empty).
 */
export function colourStatuses<T extends Status>(
  isEdit: boolean,
  consultation: readonly T[] | null,
  callCenter: readonly T[] | null,
): T[] {
  if (isEdit && consultation && consultation.length > 0) return [...consultation]
  return callCenter ? [...callCenter] : []
}

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
