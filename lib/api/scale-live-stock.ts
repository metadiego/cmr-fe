import type { components } from "./schema";
import { apiFetch } from "./client";

// Live stock from the inventory scales (Pasti). INFORMATIVE ONLY: the BE never moves book stock with
// it, and book stock includes the displays outside the warehouse, so the two numbers differ on
// purpose — never subtract them. Handoff docs/specs/stock-live-balanzas.md.
//
// The OpenAPI publishes no response schema for live-stock, so its shape is typed here from the
// handoff and checked against production (27-oct-2026, Caguas). The events endpoint IS typed.
export type ScaleStockEvent = components["schemas"]["ScaleStockEventEntity"];

export type LivePad = {
  deviceId: string;
  pad: number;
  supplierPresentationId: string;
  presentationName: string | null;
  productId: string;
  sku: string | null;
  productName: string | null;
  units: number;
  doubtful: boolean;
  kind: ScaleStockEvent["kind"];
  measuredAt: string;
};

export type LiveProductPad = Pick<
  LivePad,
  "deviceId" | "pad" | "supplierPresentationId" | "units" | "doubtful" | "measuredAt" | "presentationName"
>;

export type LiveProduct = {
  productId: string;
  sku: string | null;
  productName: string | null;
  liveUnits: number;
  doubtful: boolean;
  bookUnits: number | null;
  bookUnit: string | null;
  byPad: LiveProductPad[];
};

export type LiveWarehouse = {
  warehouseId: string;
  warehouseName: string;
  clinicId: string;
  pads: LivePad[];
  products: LiveProduct[];
};

export type LiveStock = { generatedAt: string; warehouses: LiveWarehouse[] };

// `centroId` resolves the permission in that center (X-Tenant-ID) and also goes as `centerIds`.
export function getLiveStock(opts: { centroId?: string; warehouseId?: string; productId?: string } = {}): Promise<LiveStock> {
  const sp = new URLSearchParams();
  if (opts.centroId) sp.set("centerIds", opts.centroId);
  if (opts.warehouseId) sp.set("warehouseId", opts.warehouseId);
  if (opts.productId) sp.set("productId", opts.productId);
  const q = sp.toString();
  return apiFetch<LiveStock>(`/inventory/scale/live-stock${q ? `?${q}` : ""}`, {}, opts.centroId);
}

export type StockEventsFilter = {
  centroId?: string;
  warehouseId?: string;
  deviceId?: string;
  pad?: number;
  supplierPresentationId?: string;
  limit?: number;
};

// Newest first.
export function listScaleStockEvents(f: StockEventsFilter): Promise<ScaleStockEvent[]> {
  const sp = new URLSearchParams();
  if (f.centroId) sp.set("centerIds", f.centroId);
  if (f.warehouseId) sp.set("warehouseId", f.warehouseId);
  if (f.deviceId) sp.set("deviceId", f.deviceId);
  if (f.pad != null) sp.set("pad", String(f.pad));
  if (f.supplierPresentationId) sp.set("supplierPresentationId", f.supplierPresentationId);
  sp.set("limit", String(f.limit ?? 100));
  return apiFetch<ScaleStockEvent[]>(`/inventory/scale/stock-events?${sp}`, {}, f.centroId);
}

// Retires a scale: deletes ALL its stock events in the center (e.g. a test device). Book stock is never
// touched. Requires inventario.ajustar.
export function retireScaleDevice(deviceId: string, centroId?: string): Promise<{ deviceId: string; deleted: number }> {
  const sp = new URLSearchParams({ deviceId });
  if (centroId) sp.set("centerIds", centroId);
  return apiFetch<{ deviceId: string; deleted: number }>(`/inventory/scale/stock-events?${sp}`, { method: "DELETE" }, centroId);
}
