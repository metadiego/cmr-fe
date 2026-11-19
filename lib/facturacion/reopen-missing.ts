// Check for the «Reopen invoice» dialog (components/facturacion/invoice-reopen.tsx).
// Whether the invoice CAN be reopened is the BE's call (GET …/reopen/check); this only says what is empty.

export type ReopenField = "reason";

/** ["reason"] while the reason is blank (after trim). */
export function reopenMissing(s: { reason: string }): ReopenField[] {
  return s.reason.trim() === "" ? ["reason"] : [];
}
