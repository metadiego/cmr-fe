/**
 * Option lists of the column editor's pickers (appointment lifecycle, piece 6b, Task 11).
 *
 * The lists come from the board DEFINITION (`GET /board/definition`), which two backends serve while
 * release 6b rolls out (6a: old words only; 6b: old words plus stage groups). A column's stored config
 * still holds OLD words and door slugs on both: `render.requiereEstado` is an old status word and
 * `render.transition` a door slug. So an option's `value` is exactly what gets stored; the stage group is
 * for display only.
 */

import {
  statusGroup,
  type CatalogueStatus,
  type CatalogueTransition,
} from "../lifecycle/board-catalogue.ts"
import { stageLabelKey, type StageLabel } from "../lifecycle/stage-labels.ts"
import type { AppointmentKind, StageGroup } from "../lifecycle/stage-groups.ts"

/** A picker option: `value` is what the column config stores. */
export interface PickerOption {
  value: string
  /** Message key of the text shown (a stage label), when the option is a stage. */
  labelKey: string | null
}

/** The door slugs a toggle column can call: the definition's transition slugs, once each, in order. */
export function doorSlugOptions(transitions: readonly CatalogueTransition[]): PickerOption[] {
  const seen = new Set<string>()
  const out: PickerOption[] = []
  for (const tr of transitions) {
    if (!tr.slug || seen.has(tr.slug)) continue
    seen.add(tr.slug)
    out.push({ value: tr.slug, labelKey: null })
  }
  return out
}

const labelOfGroup = (group: StageGroup): StageLabel =>
  group === "cancelled_or_not_served" ? "cancelled" : (group as StageLabel)

/**
 * The stages a column can require (`render.requiereEstado`): one option per stage group the board has a
 * status for, labelled by the group and storing that status's old word. A status of no known group is left
 * out. The result is the same for a definition with or without served groups.
 */
export function requiredStageOptions(
  kind: AppointmentKind,
  statuses: readonly CatalogueStatus[],
): PickerOption[] {
  const seen = new Set<StageGroup>()
  const out: PickerOption[] = []
  for (const status of statuses) {
    const group = statusGroup(kind, status)
    if (group === null || seen.has(group)) continue
    seen.add(group)
    out.push({ value: status.slug, labelKey: stageLabelKey(kind, labelOfGroup(group)) })
  }
  return out
}
