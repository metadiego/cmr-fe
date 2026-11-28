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
  /** Shape read from prod 16-nov (vitamin C, Caguas): an object, not a name. */
  patient: { id: string; medicalRecordNumber: string | null; name: string | null } | null;
  /** When it was written, and whether it was dated in the past (cmr-be #646). */
  recordedAt?: string | null;
  isRetroactive?: boolean;
  patientId?: string | null;
  medicalRecordNumber: string | null;
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
    /** Purchase-order / transfer number when the BE has one (follow-up of #608); else look in notes. */
    documentNumber?: string | null;
    notes: string | null;
  }>;
  applied: number;
  appliedProportion: number | null;
  closing: number;
  /** cmr-be #626; absent until it is deployed. */
  ownerFormat?: KardexOwnerFormat;
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

// ---- Delivery control of one product (BE: cmr-be #688/#690, docs/specs/control-de-entregas-por-producto.md) ----
// Generic for any product sold and delivered later at patient-desk, modeled on the owner's paper sheet for
// Nano Aer Plus; which product/center/range is up to the caller, same as the other kardex reports.

export type KardexDeliveryProduct = { id: string; sku: string; name: string; deductionMode: string };
export type KardexDeliverySoldAs = { productId: string; sku: string | null; name: string; channel: "direct" | "kit" | "protocol" };
export type KardexDeliveryLine = {
  patientId: string;
  recordNumber: string | null;
  patientName: string | null;
  invoiceDate: string | null;
  invoiceNumber: string | null;
  /** "YYYY-MM", or null for legacy purchases with no recorded invoice date. */
  month: string | null;
  sold: number;
  delivered: number;
  deliveryDates: string[];
  refunded: number;
  refundNumbers: string[];
  pending: number;
  notes: string | null;
  legacy: boolean;
  soldAs: KardexDeliverySoldAs;
  packageIds: string[];
};
export type KardexDeliveryMonth = { month: string | null; sold: number; delivered: number; pending: number };
export type KardexDeliveryProtocols = {
  total: number;
  byProtocol: Array<{ protocol: string; quantity: number }>;
  detail: Array<{ recordNumber: string | null; patientName: string | null; date: string; quantity: number; protocol: string }>;
};
export type KardexDeliveryWarehouse = {
  deductionMode: string;
  soldInPeriod: number;
  protocols: number;
  systemStock: number;
  pending: number;
  freeStock: number;
  physical: number;
};
export type KardexDeliveryWarning = { code: string; labelKey: string; quantity: number };
export type KardexDeliveryControl = {
  product: KardexDeliveryProduct;
  from: string;
  to: string;
  lines: KardexDeliveryLine[];
  months: KardexDeliveryMonth[];
  protocols: KardexDeliveryProtocols;
  warehouse: KardexDeliveryWarehouse;
  warnings: KardexDeliveryWarning[];
};

export function getKardexDeliveryControl(p: { productId: string; from: string; to: string }, centerId?: string | null) {
  return apiFetch<KardexDeliveryControl>(
    `/inventory/reports/delivery-control?${query({ productoId: p.productId, desde: p.from, hasta: p.to }, centerId)}`,
    {},
    centerId ?? undefined,
  );
}

// ---- "Compras y devoluciones" (handoff kardex-compras-y-devoluciones, 28-nov-2026): a FIXED photo of
// the period — every row already comes dated by the BE, nothing undated except `undatedLegacy`
// (legacy loads with no invoice at all, which the BE cannot place in any month). ----------------------

export type KardexPurchaseChannel = "direct" | "kit" | "legacy";
export type KardexPurchaseLine = {
  date: string;
  recordNumber: string | null;
  patientName: string | null;
  invoiceNumber: string | null;
  channel: KardexPurchaseChannel;
  /** The kit/product actually sold, when it differs from this kardex's own product (channel "kit"). */
  soldAs: { sku: string | null; name: string } | null;
  quantity: number;
};
export type KardexRefundLine = {
  date: string;
  refundNumber: string | null;
  invoiceNumber: string | null;
  recordNumber: string | null;
  patientName: string | null;
  quantity: number;
  viaKit: boolean;
};
export type KardexPurchasesRefunds = {
  product: KardexProduct;
  from: string;
  to: string;
  purchases: KardexPurchaseLine[];
  refunds: KardexRefundLine[];
  totals: { purchased: number; refunded: number; net: number };
  undatedLegacy: { packages: number; quantity: number };
};

export function getKardexPurchasesRefunds(p: { productId: string; from: string; to: string }, centerId?: string | null) {
  return apiFetch<KardexPurchasesRefunds>(
    `/inventory/reports/purchases-refunds?${query({ productoId: p.productId, desde: p.from, hasta: p.to }, centerId)}`,
    {},
    centerId ?? undefined,
  );
}

// ---- Kardex overview of ALL products (BE: cmr-be #699, docs/specs/kardex-resumen-de-todos-los-productos.md) ----
// One call for the whole catalog in a center and range, split by deduction mode so the owner can see
// "a la venta" and "a la entrega" products together or apart without picking one product at a time.

export type KardexOverviewTotals = {
  opening: number;
  inbound: number;
  applied: number;
  manualOutputs: number;
  adjustments: number;
  closing: number;
  pending: number;
  physical: number;
  freeStock: number;
};
export type KardexOverviewProduct = KardexOverviewTotals & {
  productId: string;
  sku: string;
  name: string;
  deductionMode: string;
};
export type KardexOverviewGroup = {
  deductionMode: string;
  totals: KardexOverviewTotals;
  productIds: string[];
};
export type KardexOverview = {
  from: string;
  to: string;
  products: KardexOverviewProduct[];
  groups: KardexOverviewGroup[];
  totals: KardexOverviewTotals;
};

export function getKardexOverview(p: { from: string; to: string; deductionMode?: string }, centerId?: string | null) {
  const params: Record<string, string> = { desde: p.from, hasta: p.to };
  if (p.deductionMode) params.modoDescarga = p.deductionMode;
  return apiFetch<KardexOverview>(
    `/inventory/reports/kardex-overview?${query(params, centerId)}`,
    {},
    centerId ?? undefined,
  );
}

/** The management summary in the owner's sheet layout (cmr-be #626): classified by the BE, painted here. */
export type KardexOwnerFormat = {
  opening: number;
  inbound: Array<{ date: string; supplier: string | null; documentNumber: string | null; quantity: number; notes: string | null }>;
  /** Manual outputs (reasons with kardex_column = 'salidas'), shown as positive quantities. */
  manualOutputs: Array<{ date: string; reason: string | null; adjustmentNumber: string | number | null; quantity: number; notes: string | null }>;
  appliedNet: number;
  appliedProportion: number | null;
  /** Load corrections: one «Correcciones de carga» row only when the net is not 0. */
  correctionsNet: number;
  corrections: Array<{ date: string; reason: string | null; quantity: number; notes: string | null }>;
  closing: number;
  closingBySupplier: Array<{ supplier: string | null; quantity: number }>;
};
