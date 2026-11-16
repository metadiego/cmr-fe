import { apiFetch } from "./client";

// ---- Daily kardex of one product (BE: docs/specs/kardex-diario-de-inventario.md) ----------------

export type KardexDay = {
  date: string;
  opening: number;
  inbound: number;
  applied: number;
  /** Informational: open-vial content ÷ vial capacity; null when the product has no capacity. */
  appliedProportion: number | null;
  adjustments: number;
  closing: number;
};
export type KardexProduct = { id: string; sku: string; name: string; capacity: number | null };
export type KardexDaily = { product: KardexProduct; days: KardexDay[] };
export type KardexDayMovement = {
  id: string;
  effectiveDate: string;
  type: string;
  reason: string | null;
  kardexColumn: "entradas" | "aplicadas" | "ajustes";
  signedQuantity: number;
  openVial: boolean;
  documentType: string | null;
  documentId: string | null;
  notes: string | null;
  patient: string | null;
  record: string | null;
  sessionNumber: number | null;
  sessionsTotal: number | null;
};
export type KardexSummary = {
  product: KardexProduct;
  from: string;
  to: string;
  opening: number;
  lines: Array<{
    date: string;
    kind: "inbound" | "adjustment";
    reason: string | null;
    quantity: number;
    documentType: string | null;
    documentId: string | null;
    notes: string | null;
  }>;
  applied: number;
  appliedProportion: number | null;
  closing: number;
};

// Query params stay in Spanish (productoId, desde, hasta, fecha): that is the BE controller today, not a
// choice made here (CLAUDE.md rule 6 spirit). centerIds goes along so the BE resolves inventario.read for
// THAT center, not only the active one.
function query(params: Record<string, string>, centerId?: string | null): string {
  const qs = new URLSearchParams(params);
  if (centerId) qs.set("centerIds", centerId);
  return qs.toString();
}

export function getDailyKardex(p: { productId: string; from: string; to: string }, centerId?: string | null) {
  return apiFetch<KardexDaily>(
    `/inventory/reports/daily-kardex?${query({ productoId: p.productId, desde: p.from, hasta: p.to }, centerId)}`,
    {},
    centerId ?? undefined,
  );
}

export function getKardexDay(p: { productId: string; date: string }, centerId?: string | null) {
  return apiFetch<KardexDayMovement[]>(
    `/inventory/reports/daily-kardex/day?${query({ productoId: p.productId, fecha: p.date }, centerId)}`,
    {},
    centerId ?? undefined,
  );
}

export function getKardexSummary(p: { productId: string; from: string; to: string }, centerId?: string | null) {
  return apiFetch<KardexSummary>(
    `/inventory/reports/kardex-summary?${query({ productoId: p.productId, desde: p.from, hasta: p.to }, centerId)}`,
    {},
    centerId ?? undefined,
  );
}
