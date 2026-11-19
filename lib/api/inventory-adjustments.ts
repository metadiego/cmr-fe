import { apiFetch } from "./client";

// Inventory adjustments with one OR several products, saved all-or-nothing under one number (owner,
// 18-nov-2026; cmr-be #627, handoff docs/specs/ajuste-varios-productos-handoff-be.md). The request goes in
// English keys (the v2 glossary maps them); the BE answers { documentId, number, lines }. Errors carry
// { code, labelKey, index } so the screen can point at the line.

export type AdjustmentSign = "positivo" | "negativo";

export interface AdjustmentLineInput {
  productId: string;
  quantity: number;
  sign: AdjustmentSign;
  lotId?: string;
  reason?: string;
  notes?: string;
}
export interface AdjustmentInput {
  warehouseId: string;
  reason?: string;
  effectiveDate?: string;
  notes: string;
  patientId?: string;
  lines: AdjustmentLineInput[];
}

export interface AdjustmentRow {
  documentId: string;
  number: string | null;
  clinicId: string;
  effectiveDate: string | null;
  createdAt: string;
  warehouseId: string | null;
  warehouse: string | null;
  reason: string | null;
  patientId: string | null;
  patient: string | { id: string; name: string | null; medicalRecordNumber: string | null } | null;
  medicalRecordNumber: string | null;
  notes: string | null;
  lines: number;
  netUnits: number;
  registeredBy: string | null;
}
export interface AdjustmentDetail extends Omit<AdjustmentRow, "lines"> {
  lines: Array<{
    movementId: string;
    productId: string;
    product: { name: string; sku: string | null } | null;
    signedQuantity: number;
    reason: string | null;
    lotId: string | null;
    lotNumber: string | null;
    notes: string | null;
  }>;
}

export function createAdjustment(input: AdjustmentInput, centerId?: string | null) {
  // effectiveDate / isRetroactive: cmr-be #646 (a past day is stored at 12:00 of the center).
  return apiFetch<{ documentId: string; number: string; lines: unknown[]; effectiveDate?: string; isRetroactive?: boolean }>(
    `/inventory/adjustments${centerId ? `?centerIds=${encodeURIComponent(centerId)}` : ""}`,
    { method: "POST", body: JSON.stringify(input) },
    centerId ?? undefined,
  );
}

export function listAdjustments(p: { from?: string; to?: string; centerId?: string | null }): Promise<AdjustmentRow[]> {
  const qs = new URLSearchParams();
  if (p.from) qs.set("desde", p.from);
  if (p.to) qs.set("hasta", p.to);
  if (p.centerId) qs.set("centerIds", p.centerId);
  return apiFetch<AdjustmentRow[]>(`/inventory/adjustments?${qs}`, {}, p.centerId ?? undefined);
}

export function getAdjustment(documentId: string, centerId?: string | null): Promise<AdjustmentDetail> {
  return apiFetch<AdjustmentDetail>(`/inventory/adjustments/${encodeURIComponent(documentId)}`, {}, centerId ?? undefined);
}

/** The patient of a row/detail as text: the v2 edge enricher may wrap it into an object. */
export function patientName(p: AdjustmentRow["patient"]): string | null {
  if (!p) return null;
  return typeof p === "string" ? p : p.name;
}
