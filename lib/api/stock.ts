import { apiFetch, apiFetchPaged } from "./client";
import type { Paginated } from "./types";

// Stock por centro y consolidado (BE PR #248). SOLO LECTURA. Tenant-scoped: gerente ve su centro; admin
// elige centro (X-Tenant-ID) o, sin centro, ve el consolidado de todos los centros a los que alcanza.
// Contrato: HANDOFF-pantalla-stock-por-centro / cmr-be/docs/specs/stock-por-centro.md.
// NOTA: NO están en el mapa BE (llegan en español): almacenNombre, unidadClave, bajoMinimo, rinde,
// equivalencias, comprometido, dañado, disponible.

export type StockModoDescarga = "a_la_venta" | "a_la_entrega" | "no_descarga";

// Por centro: una fila por producto/almacén/lote. El BE ya ordena: negativos → vencidos → por vencer →
// nombre (no reordenar por defecto: se quieren ver los problemas). `negative` se permite (realidad clínica).
export type StockResumenFila = {
  productId: string;
  sku?: string | null;
  name?: string | null;
  technicalName?: string | null;
  warehouseId?: string | null;
  almacenNombre?: string | null;
  lotId?: string | null;
  lotNumber?: string | null;
  expirationDate?: string | null;
  quantity: number;
  negative: boolean;
  expired: boolean;
  expiringSoon: boolean;
  deductionMode?: StockModoDescarga | null;
  // Campos nuevos del visor genérico (handoff visor-de-existencias). Todos pueden faltar en datos viejos.
  unit?: string | null; // nombre largo (respaldo)
  unidadClave?: string | null; // g|mg|ml|u → i18n; NUNCA pintar la cifra sola. Puede venir null (no pintar sufijo)
  minStock?: number | null; // mínimo del centro; null = sin mínimo, no avisar
  bajoMinimo?: boolean;
  isInventoryItem?: boolean;
  // Semáforo YA resuelto por el BE (no recalcular): prioridad negativo>vencido>por_vencer>bajo_minimo>normal.
  status?: "negativo" | "vencido" | "por_vencer" | "bajo_minimo" | "normal" | string | null;
  rinde?: number | null; // atajo cuando hay UNA presentación; si varias, null → usar equivalencias
  // «Alcanza para N de X»: ordenadas de menor a mayor dosis. [] = no es insumo de nada (no pintar).
  equivalencias?: { sku?: string | null; name?: string | null; dose?: number | null; rinde?: number | null }[];
};

export type StockEquivalencia = NonNullable<StockResumenFila["equivalencias"]>[number];

export type StockResumenParams = {
  q?: string;
  warehouseId?: string;
  onlyNegative?: boolean;
  onlyExpiring?: boolean;
  asOf?: string;
  // Por defecto el BE solo trae lo que se inventaría; true incluye no-inventariables (auditar negativos raros).
  includeNonInventoryItems?: boolean;
  page?: number;
  limit?: number;
};
export function getStockResumen(
  params: StockResumenParams = {},
  centro?: string | null,
): Promise<Paginated<StockResumenFila>> {
  const sp = new URLSearchParams();
  if (params.q?.trim()) sp.set("q", params.q.trim());
  if (params.warehouseId) sp.set("warehouseId", params.warehouseId);
  if (params.onlyNegative) sp.set("onlyNegative", "true");
  if (params.onlyExpiring) sp.set("onlyExpiring", "true");
  if (params.asOf) sp.set("asOf", params.asOf);
  if (params.includeNonInventoryItems) sp.set("includeNonInventoryItems", "true");
  sp.set("page", String(params.page ?? 1));
  sp.set("limit", String(Math.min(params.limit ?? 50, 100)));
  return apiFetchPaged<StockResumenFila>(`/inventory/stock/summary?${sp.toString()}`, {}, centro);
}

// Consolidado: una fila por producto con `byCenter` (centroId → cantidad) + `total`. Las COLUMNAS = claves
// de `byCenter` (con un centro fijo trae UNA sola columna); los NOMBRES de centro se resuelven con el
// catálogo de centros (getCenters), no vienen en la respuesta. NO sumar el total en el cliente: viene del BE.
export type StockConsolidadoFila = {
  productId: string;
  sku?: string | null;
  name?: string | null;
  technicalName?: string | null;
  byCenter: Record<string, number>;
  total: number;
  negative: boolean;
};

export type StockConsolidadoParams = {
  q?: string;
  onlyNegative?: boolean;
  asOf?: string;
  includeNonInventoryItems?: boolean;
  page?: number;
  limit?: number;
};
export function getStockConsolidado(
  params: StockConsolidadoParams = {},
  centro?: string | null,
): Promise<Paginated<StockConsolidadoFila>> {
  const sp = new URLSearchParams();
  if (params.q?.trim()) sp.set("q", params.q.trim());
  if (params.onlyNegative) sp.set("onlyNegative", "true");
  if (params.asOf) sp.set("asOf", params.asOf);
  if (params.includeNonInventoryItems) sp.set("includeNonInventoryItems", "true");
  sp.set("page", String(params.page ?? 1));
  sp.set("limit", String(Math.min(params.limit ?? 50, 100)));
  // `centro` undefined → admin combinado (todos los centros); un id → recortado a ese centro (1 columna).
  return apiFetchPaged<StockConsolidadoFila>(`/inventory/stock/consolidated?${sp.toString()}`, {}, centro);
}

// Detalle de la existencia de UN producto: desglose por almacén/lote con los estados que componen la
// cantidad (físico, reservado, comprometido, dañado, disponible). Explica DÓNDE está y por qué un negativo.
// NOTA: NO es el libro de movimientos (Entró/Salió); ese historial aún no tiene endpoint en el BE.
// GET /inventory/stock/detail?productId= — tenant-scoped (centro activo).
export type StockDetalleFila = {
  productId: string;
  warehouseId?: string | null;
  almacenNombre?: string | null;
  lotId?: string | null;
  lotNumber?: string | null;
  quantity: number;
  negative?: boolean;
  physical?: number;
  reserved?: number;
  comprometido?: number;
  dañado?: number;
  disponible?: number;
};
export function getStockDetalle(productId: string, centro?: string | null): Promise<StockDetalleFila[]> {
  return apiFetch<unknown>(
    `/inventory/stock/detail?productId=${encodeURIComponent(productId)}`,
    {},
    centro,
  ).then((r) => (Array.isArray(r) ? (r as StockDetalleFila[]) : (((r as { items?: StockDetalleFila[] })?.items) ?? [])));
}
