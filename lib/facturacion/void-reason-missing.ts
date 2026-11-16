// Check for the dialogs that void an invoice or a refund with a reason
// (components/facturacion/factura-row-actions.tsx, components/facturacion/devoluciones-list-view.tsx,
// app/(app)/billing/invoices/[id]/returns/[devId]/page.tsx).

export type VoidReasonField = "reason";

/** ["reason"] while the reason is blank (after trim). */
export function voidReasonMissing(s: { reason: string }): VoidReasonField[] {
  return s.reason.trim() === "" ? ["reason"] : [];
}
