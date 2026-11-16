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

export function getKardexDiario(p: { productId: string; from: string; to: string }, tenant?: string | null) {
  const qs = new URLSearchParams({ productoId: p.productId, desde: p.from, hasta: p.to });
  return apiFetch<KardexDaily>(`/inventory/reports/daily-kardex?${qs}`, {}, tenant ?? undefined);
}

export function getKardexDia(p: { productId: string; date: string }, tenant?: string | null) {
  const qs = new URLSearchParams({ productoId: p.productId, fecha: p.date });
  return apiFetch<KardexDayMovement[]>(`/inventory/reports/daily-kardex/day?${qs}`, {}, tenant ?? undefined);
}

export function getKardexResumen(p: { productId: string; from: string; to: string }, tenant?: string | null) {
  const qs = new URLSearchParams({ productoId: p.productId, desde: p.from, hasta: p.to });
  return apiFetch<KardexSummary>(`/inventory/reports/kardex-summary?${qs}`, {}, tenant ?? undefined);
}
