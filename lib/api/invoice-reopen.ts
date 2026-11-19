import type { components } from "./schema";
import { apiFetch, apiFetchEnvelope } from "./client";
import type { ApiWarning } from "./types";
import type { FacturaConItems } from "./facturas";

// Reopen an issued invoice to correct it: it goes back to draft WITH ITS SAME NUMBER and is issued again.
// The BE decides whether it can (check) and does the side effects (stock back, unused session packs
// voided, auto-present cancelled, payments kept). Handoff docs/specs/reabrir-factura-handoff-fe.md.

export type ReopenCheck = components["schemas"]["InvoiceReopenCheckDto"];
export type InvoiceReopening = components["schemas"]["InvoiceReopeningDto"];

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

// Factura facturada al paciente equivocado (caso 001103): cambia a quién está facturada sin tocar
// número ni total. Reusa el mismo gate que reabrir (GET .../reopen/check — ya tiene en cuenta
// `invoice_reopen.any_date`): mismo día para quien factura, cualquier fecha para gerencia/admin.
// 400 posibles: INVOICE_CHANGE_PATIENT_SAME/_UNKNOWN/_HAS_APPOINTMENT, o INVOICE_REOPEN_NOT_ALLOWED.
// Handoff cambiar-el-paciente-de-una-factura.
export async function changeInvoicePatient(
  invoiceId: string,
  patientId: string,
  reason: string,
  centerId?: string,
): Promise<{ invoice: FacturaConItems; warnings: ApiWarning[] }> {
  const env = await apiFetchEnvelope<FacturaConItems>(
    `/invoices/${invoiceId}/change-patient`,
    { method: "POST", body: JSON.stringify({ patientId, reason }) },
    centerId,
  );
  return { invoice: env.data, warnings: env.meta?.warnings ?? [] };
}
