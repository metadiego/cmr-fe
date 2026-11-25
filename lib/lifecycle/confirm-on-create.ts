// Creating an appointment or a session already confirmed (cmr-be 4a: `confirmed: true` on every creation
// door). It needs `appointments.confirm` in the center the row is created in; without it the backend
// refuses the whole request (403). Screens show the confirm toggle only where it is held, and never ask
// for a confirmation they know will be refused. Hand-off appointment-lifecycle-switch-fe.md §4.

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

/** The permission that confirms, for both kinds. */
export const CONFIRM_PERMISSION = "appointments.confirm"
