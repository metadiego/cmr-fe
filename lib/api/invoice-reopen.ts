import type { components } from "./schema";
import { apiFetch, apiFetchEnvelope } from "./client";
import type { ApiWarning } from "./types";
import type { FacturaConItems } from "./facturas";

// Reopen an issued invoice to correct it: it goes back to draft WITH ITS SAME NUMBER and is issued again.
// The BE decides whether it can (check) and does the side effects (stock back, unused session packs
// voided, auto-present cancelled, payments kept). Handoff docs/specs/reabrir-factura-handoff-fe.md.

export type ReopenReason = components["schemas"]["InvoiceReopenReasonDto"];

// `warnings` is in the real response (verified 2026-10-08) but not in the Swagger DTO yet.
export type ReopenCheck = components["schemas"]["InvoiceReopenCheckDto"] & { warnings?: ReopenReason[] };

// `reopenedBy` is declared as a user id; tolerate the {id, name} projection issuedBy already uses.
export type InvoiceReopening = Omit<components["schemas"]["InvoiceReopeningDto"], "reopenedBy"> & {
  reopenedBy: string | { id?: string; name?: string | null } | null;
};

export function getReopenCheck(invoiceId: string, centerId?: string): Promise<ReopenCheck> {
  return apiFetch<ReopenCheck>(`/invoices/${invoiceId}/reopen/check`, {}, centerId);
}

export async function reopenInvoice(
  invoiceId: string,
  reason: string,
  centerId?: string,
): Promise<{ invoice: FacturaConItems; warnings: ApiWarning[] }> {
  const env = await apiFetchEnvelope<FacturaConItems>(
    `/invoices/${invoiceId}/reopen`,
    { method: "POST", body: JSON.stringify({ reason }) },
    centerId,
  );
  return { invoice: env.data, warnings: env.meta?.warnings ?? [] };
}

export function listReopenings(invoiceId: string, centerId?: string): Promise<InvoiceReopening[]> {
  return apiFetch<InvoiceReopening[]>(`/invoices/${invoiceId}/reopenings`, {}, centerId);
}
