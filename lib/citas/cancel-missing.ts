// Checks for the «Cancelar cita» dialog (components/citas/cita-actions.tsx). Same condition the button used
// before: a reason, counted after trimming.

export type CancelField = "reason";

/** Required fields still empty. */
export function cancelMissing(s: { reason: string }): CancelField[] {
  return s.reason.trim() ? [] : ["reason"];
}
