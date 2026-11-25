// Creating an appointment or a session already confirmed (cmr-be 4a: `confirmed: true` on every creation
// door). It needs `appointments.confirm` in the center the row is created in; without it the backend
// refuses the whole request (403). Screens never ask for a confirmation they know will be refused, and show
// the confirm toggle unless the permission is known to be missing. Flows with no toggle (Nueva cita on the
// board, the next-appointment cell, the board walk-in) ask for a confirmed booking: while the permission is
// not known yet they still send true (as the status-based flow did); when it is known to be missing they
// send false and say so. Hand-off appointment-lifecycle-switch-fe.md §4.

/** Whether a permission is held in `target`, from the centers where it is held; null = not known. */
export function heldInCenter(
  centers: ReadonlyArray<{ id: string }> | null | undefined,
  target: string | null | undefined,
): boolean | null {
  if (!centers || !target) return null
  return centers.some((c) => c.id === target)
}

/** The `confirmed` a creation sends: what was asked, unless the permission is known to be missing. */
export function createConfirmed(wanted: boolean, canConfirmHere: boolean | null): boolean {
  return wanted && canConfirmHere !== false
}

/** Whether a create form shows its "book as confirmed" toggle: unless the permission is known missing. */
export function confirmToggleShown(canConfirmHere: boolean | null): boolean {
  return canConfirmHere !== false
}

/**
 * Whether to tell the person the booking was made unconfirmed: a confirmed one was asked for (or implied)
 * and the permission is known to be missing here, so it was sent as booked. It needs confirming before
 * it shows on the care board.
 */
export function bookedUnconfirmedNotice(wanted: boolean, canConfirmHere: boolean | null): boolean {
  return wanted && canConfirmHere === false
}

/** The permission that confirms, for both kinds. */
export const CONFIRM_PERMISSION = "appointments.confirm"
