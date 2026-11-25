// What the backend's action catalogue (cmr-be piece 3) allows for Cancel and No-show, by the row's old
// status. The backend is the gate (it answers LIFECYCLE_ACTION_NOT_ALLOWED); this only keeps the screens
// from offering a button the backend refuses, and names Cancel for what it does. Piece 4 replaces it with
// the row's `allowedActions`. Hand-off: docs/specs/appointment-actions-board.md.
//
// The old statuses mean the same stage in both kinds (medical appointments and therapy sessions), so one
// table serves both: `presente` is arrived and waiting (or called, therapy), `triage` is medical only.

/** What Cancel does on a row in this status: a plain cancel, "arrived, not served", or nothing (hidden). */
export type CancelMeaning = "cancel" | "not_serve" | null

/** Arrived and still waiting (called or in triage included): Cancel records "not served". */
const ARRIVED_WAITING = new Set(["presente", "triage"])

/** In consultation, in therapy, done, or already closed: the backend refuses Cancel. */
const NO_CANCEL = new Set([
  "en_consulta",
  "atendida",
  "en_terapia",
  "asistido",
  "cancelada",
  "no_show",
  "reprogramada",
])

/** Booked or confirmed, never arrived: the only statuses No-show starts from (medical). */
const BEFORE_ARRIVAL = new Set(["programada", "confirmada"])

/** Cancel's meaning for a row in `status`. An unknown status keeps the plain Cancel: the backend decides. */
export function cancelMeaning(status: string): CancelMeaning {
  if (NO_CANCEL.has(status)) return null
  if (ARRIVED_WAITING.has(status)) return "not_serve"
  return "cancel"
}

/** No-show only before arrival and only for today or a past day (`date`, `today`: YYYY-MM-DD). */
export function noShowAllowed(status: string, date: string | null | undefined, today: string): boolean {
  if (!BEFORE_ARRIVAL.has(status)) return false
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
  status: string,
  date: string | null | undefined,
  today: string,
): { visible: boolean; labelKey: string } {
  if (slug === CANCEL_SLUG) {
    const meaning = cancelMeaning(status)
    return { visible: meaning !== null, labelKey: meaning === "not_serve" ? NOT_SERVE_LABEL_KEY : labelKey }
  }
  if (slug === NO_SHOW_SLUG) return { visible: noShowAllowed(status, date, today), labelKey }
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
