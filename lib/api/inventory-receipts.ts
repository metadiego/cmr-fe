import { apiFetch } from "./client";

// Purchase receptions «as they were loaded» (owner, 18-nov-2026; handoff
// docs/specs/lista-de-recepciones-handoff.md). Permission inventario.read. Query params stay in Spanish
// (desde / hasta): that is the BE controller today.

/** One row per reception (one documentId), newest first. */
export interface ReceiptRow {
  documentId: string;
  clinicId: string;
  clinicName?: string | null;
  effectiveDate: string | null;
  createdAt: string;
  warehouseId: string | null;
  warehouse: string | null;
  supplier: string | null;
  purchaseInvoiceNumber: string | null;
  lines: number;
  units: number;
  /** null when it was loaded without cost. */
  totalCost: number | null;
  /** Who loaded it; null for old rows without a user. */
  registeredBy: string | null;
}

/** GET /inventory/operations/receipts/:documentId — the BE's `recepcion()`, keys through the v2 glossary. */
export interface ReceiptLine {
  movementId?: string;
  productId: string;
  quantity: number;
  unitCost: number | null;
  lotId: string | null;
  lotNumber: string | null;
  expirationDate: string | null;
  notes: string | null;
}
export interface Receipt {
  documentId: string;
  date: string | null;
  warehouseId: string | null;
  supplierId: string | null;
  purchaseInvoiceNumber: string | null;
  lines: ReceiptLine[];
}

export function listReceipts(p: { from?: string; to?: string; centerId?: string | null }): Promise<ReceiptRow[]> {
  const qs = new URLSearchParams();
  if (p.from) qs.set("desde", p.from);
  if (p.to) qs.set("hasta", p.to);
  if (p.centerId) qs.set("centerIds", p.centerId);
  return apiFetch<ReceiptRow[]>(`/inventory/reports/receipts?${qs}`, {}, p.centerId ?? undefined);
}

/** The BE finds it in any center the caller reads; the tenant is the row's own center. */
export function getReceipt(documentId: string, centerId?: string | null): Promise<Receipt> {
  return apiFetch<Receipt>(`/inventory/operations/receipts/${encodeURIComponent(documentId)}`, {}, centerId ?? undefined);
}
