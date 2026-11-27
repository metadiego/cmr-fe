// The status part of a patient-desk chip (components/patient-desk/patient-chips.tsx): the label is the
// row's STAGE label (`lifecycle.label.*`, so not served reads as such), the colour the board status of the
// row's stage group (lib/lifecycle/board-catalogue.ts), under both definition shapes.

import { statusOfGroup, type CatalogueStatus } from "../lifecycle/board-catalogue.ts"
import type { AppointmentKind, StageGroup } from "../lifecycle/stage-groups.ts"
import { stageLabelKey, type StageLabel } from "../lifecycle/stage-labels.ts"

export function chipStatus(
  kind: AppointmentKind,
  statuses: readonly (CatalogueStatus & { color?: string | null })[],
  group: StageGroup | null,
  label: StageLabel | null,
): { labelKey: string | null; color: string | null } {
  return {
    labelKey: label ? stageLabelKey(kind, label) : null,
    color: statusOfGroup(kind, statuses, group)?.color ?? null,
  }
}
