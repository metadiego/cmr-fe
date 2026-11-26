/**
 * The label a row's status shows, named by its stage (appointment lifecycle, piece 5d). A label is the
 * row's stage group, with cancelled and not served told apart (one group, two truths the screens name).
 * Texts live under `lifecycle.label.<kind>.<label>` (messages/*.json) and read as the old status label
 * did for every old value; only not served gets its own words (as on the Citas screen).
 */

import {
  MEDICAL_GROUPS,
  THERAPY_GROUPS,
  groupOf,
  stagesOf,
  type AppointmentKind,
  type StagedRow,
  type StageGroup,
} from "./stage-groups.ts"

export type StageLabel =
  | Exclude<StageGroup, "cancelled_or_not_served">
  | "cancelled"
  | "not_served"

const labelsOf = (groups: readonly StageGroup[]): readonly StageLabel[] =>
  Object.freeze(
    groups.flatMap((g): StageLabel[] =>
      g === "cancelled_or_not_served" ? ["cancelled", "not_served"] : [g]
    )
  )

/** Every label a row of each kind can show. */
export const STAGE_LABELS: Readonly<Record<AppointmentKind, readonly StageLabel[]>> = {
  medical: labelsOf(MEDICAL_GROUPS),
  therapy: labelsOf(THERAPY_GROUPS),
}

/** The row's label, or null for a status the mapping does not know (the screen shows it raw). */
export function stageLabel(kind: AppointmentKind, row: StagedRow): StageLabel | null {
  const stages = stagesOf(kind, row)
  if (!stages) return null
  if (stages.care === "not_served") return "not_served"
  const group = groupOf(kind, stages)
  return group === "cancelled_or_not_served" ? "cancelled" : group
}

/**
 * The text a row's status shows: its stage label (`lifecycle.label.*`), or, for a status the mapping
 * does not know, the raw value (`fallback`, the row's `status`, "" when none). `t` is the root translator.
 */
export function stageLabelText(
  t: (key: string) => string,
  kind: AppointmentKind,
  row: StagedRow & { status?: string | null },
  fallback: string | null | undefined = row.status
): string {
  return labelText(t, kind, stageLabel(kind, row), fallback)
}

/** The same for a label already worked out (a derived appointment carries it): text, or `raw`. */
export function labelText(
  t: (key: string) => string,
  kind: AppointmentKind,
  label: StageLabel | null,
  raw: string | null | undefined
): string {
  return label ? t(stageLabelKey(kind, label)) : (raw ?? "")
}

/** The message key of a label. */
export const stageLabelKey = (kind: AppointmentKind, label: StageLabel): string =>
  `lifecycle.label.${kind}.${label}`
