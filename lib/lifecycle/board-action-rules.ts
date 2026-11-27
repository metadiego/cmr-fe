// What the backend's action catalogue (cmr-be piece 3) allows for Cancel and No-show, by the row's stage
// group. The backend is the gate (it answers LIFECYCLE_ACTION_NOT_ALLOWED); this only keeps the screens
// from offering a button the backend refuses, and names Cancel for what it does. Piece 4a adds the row's
// `allowedActions` (lib/lifecycle/allowed-actions.ts): a row that carries the list is drawn from it, and
// these stage rules only apply to a row without it. Hand-off: docs/specs/appointment-actions-board.md.

import {
  rowInGroups,
  type AppointmentKind,
  type StagedRow,
  type StageGroup,
} from "./stage-groups.ts"

type ByKind = Readonly<Record<AppointmentKind, readonly StageGroup[]>>

/** What Cancel does on a row: a plain cancel, "arrived, not served", or nothing (hidden). */
export type CancelMeaning = "cancel" | "not_serve" | null

/** Arrived and still waiting (called or in triage included): Cancel records "not served". */
const CANCEL_IS_NOT_SERVE: ByKind = {
  medical: ["waiting", "triage"],
  therapy: ["waiting"],
}

/** In consultation, in therapy, done, or already closed (not served included): the backend refuses Cancel. */
const CANCEL_REFUSED: ByKind = {
  medical: ["in_consultation", "done", "no_show", "cancelled_or_not_served", "rescheduled"],
  therapy: ["in_therapy", "done", "cancelled_or_not_served"],
}

/** Booked or confirmed, never arrived: the only groups No-show starts from (medical; therapy has none). */
const NO_SHOW_FROM: ByKind = {
  medical: ["booked", "confirmed"],
  therapy: [],
}

/** Cancel's meaning from the row's `allowedActions` (cmr-be 4a). */
export function cancelMeaningFromList(allowed: readonly string[]): CancelMeaning {
  if (allowed.includes("not_serve")) return "not_serve"
  if (allowed.includes("cancel")) return "cancel"
  return null
}

/**
 * Cancel's meaning on a row. When the row carries its `allowedActions` the list decides; without it,
 * the row's stage group does. A status the mapping does not know keeps the plain Cancel: the backend
 * decides.
 */
export function cancelMeaning(
  kind: AppointmentKind,
  row: StagedRow,
  allowed?: readonly string[] | null,
): CancelMeaning {
  if (allowed) return cancelMeaningFromList(allowed)
  if (rowInGroups(kind, row, CANCEL_REFUSED[kind])) return null
  if (rowInGroups(kind, row, CANCEL_IS_NOT_SERVE[kind])) return "not_serve"
  return "cancel"
}

/**
 * «Cancelar todas» on a Patient-desk row: only while the row's own session can still be cancelled
 * (booked, or arrived and not started). Once therapy started (in therapy or attended) the row offers no
 * cancel at all, so the day-wide one does not stand in for the missing single cancel (it skips those
 * sessions anyway).
 */
export function cancelAllOffered(meaning: CancelMeaning, cancelled: boolean): boolean {
  return !cancelled && meaning !== null
}

/** No-show only before arrival and only for today or a past day (`date`, `today`: YYYY-MM-DD). */
export function noShowAllowed(
  kind: AppointmentKind,
  row: StagedRow,
  date: string | null | undefined,
  today: string,
): boolean {
  if (!rowInGroups(kind, row, NO_SHOW_FROM[kind])) return false
  return !date || date <= today
}

/** Board transition slugs this rule governs (the rest keep the board's own `fromStatuses`). */
export const CANCEL_SLUG = "cancelar"
export const NO_SHOW_SLUG = "no_show"

/** The label key Cancel shows for this meaning (the board row's own label for a plain cancel). */
export const NOT_SERVE_LABEL_KEY = "lifecycle.action.not_serve"

/**
 * Whether a board transition is offered on a row, and under which label: Cancel and No-show follow the
 * rules above; any other slug is left to the board (`labelKey` unchanged).
 */
export function boardActionView(
  slug: string,
  labelKey: string,
  kind: AppointmentKind,
  row: StagedRow,
  date: string | null | undefined,
  today: string,
): { visible: boolean; labelKey: string } {
  if (slug === CANCEL_SLUG) {
    const meaning = cancelMeaning(kind, row)
    return { visible: meaning !== null, labelKey: meaning === "not_serve" ? NOT_SERVE_LABEL_KEY : labelKey }
  }
  if (slug === NO_SHOW_SLUG) return { visible: noShowAllowed(kind, row, date, today), labelKey }
  return { visible: true, labelKey }
}

/**
 * The backend refused because the row is not where this screen thinks it is (the action no longer
 * applies, or someone else moved it a moment ago): the screen refetches the row so its buttons redraw.
 * The toast still shows; nothing is retried.
 */
export function refusalRefreshesRow(err: unknown): boolean {
  const code = (err as { code?: unknown } | null)?.code
  return code === "LIFECYCLE_ACTION_NOT_ALLOWED" || code === "LIFECYCLE_STALE"
}
