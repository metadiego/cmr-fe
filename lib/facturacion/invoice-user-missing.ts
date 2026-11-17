// Check for the «Correct the responsible user» dialog on the invoice page
// (app/(app)/billing/invoices/[id]/page.tsx, UsuarioDialog). Whether the change is allowed is the BE's call.

export type InvoiceUserField = "user";

/** ["user"] while no user is picked. */
export function invoiceUserMissing(s: { userId: string | null | undefined }): InvoiceUserField[] {
  return (s.userId ?? "").trim() === "" ? ["user"] : [];
}
