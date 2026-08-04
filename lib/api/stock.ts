import { apiFetchPaged } from "./client";
import type { Paginated } from "./types";

// Stock por centro y consolidado (BE PR #248). SOLO LECTURA. Tenant-scoped: gerente ve su centro; admin
// elige centro (X-Tenant-ID) o, sin centro, ve el consolidado de todos los centros a los que alcanza.
// Contrato: HANDOFF-pantalla-stock-por-centro / cmr-be/docs/specs/stock-por-centro.md.

export type StockModoDescarga = "a_la_venta" | "a_la_entrega" | "no_descarga";

// Por centro: una fila por producto/almacén/lote. El BE ya ordena: negativos → vencidos → por vencer →
// nombre (no reordenar por defecto: se quieren ver los problemas). `negativo` se permite (realidad clínica).
export type StockResumenFila = {
  productoId: string;
  sku?: string | null;
  nombre?: string | null;
  nombreTecnico?: string | null;
  almacenId?: string | null;
  almacenNombre?: string | null;
  loteId?: string | null;
  numeroLote?: string | null;
  fechaVencimiento?: string | null;
  cantidad: number;
  negativo: boolean;
  vencido: boolean;
  porVencer: boolean;
  modoDescarga?: StockModoDescarga | null;
};

export type StockResumenParams = {
  q?: string;
  almacenId?: string;
  soloNegativos?: boolean;
  soloPorVencer?: boolean;
  asOf?: string;
  page?: number;
  limit?: number;
};
export function getStockResumen(
  params: StockResumenParams = {},
  centro?: string | null,
): Promise<Paginated<StockResumenFila>> {
  const sp = new URLSearchParams();
  if (params.q?.trim()) sp.set("q", params.q.trim());
  if (params.almacenId) sp.set("almacenId", params.almacenId);
  if (params.soloNegativos) sp.set("soloNegativos", "true");
  if (params.soloPorVencer) sp.set("soloPorVencer", "true");
  if (params.asOf) sp.set("asOf", params.asOf);
  sp.set("page", String(params.page ?? 1));
  sp.set("limit", String(Math.min(params.limit ?? 50, 100)));
  return apiFetchPaged<StockResumenFila>(`/inventario/stock/resumen?${sp.toString()}`, {}, centro);
}

// Consolidado: una fila por producto con `porCentro` (centroId → cantidad) + `total`. Las COLUMNAS = claves
// de `porCentro` (con un centro fijo trae UNA sola columna); los NOMBRES de centro se resuelven con el
// catálogo de centros (getCenters), no vienen en la respuesta. NO sumar el total en el cliente: viene del BE.
export type StockConsolidadoFila = {
  productoId: string;
  sku?: string | null;
  nombre?: string | null;
  nombreTecnico?: string | null;
  porCentro: Record<string, number>;
  total: number;
  negativo: boolean;
};

export type StockConsolidadoParams = {
  q?: string;
  soloNegativos?: boolean;
  asOf?: string;
  page?: number;
  limit?: number;
};
export function getStockConsolidado(
  params: StockConsolidadoParams = {},
  centro?: string | null,
): Promise<Paginated<StockConsolidadoFila>> {
  const sp = new URLSearchParams();
  if (params.q?.trim()) sp.set("q", params.q.trim());
  if (params.soloNegativos) sp.set("soloNegativos", "true");
  if (params.asOf) sp.set("asOf", params.asOf);
  sp.set("page", String(params.page ?? 1));
  sp.set("limit", String(Math.min(params.limit ?? 50, 100)));
  // `centro` undefined → admin combinado (todos los centros); un id → recortado a ese centro (1 columna).
  return apiFetchPaged<StockConsolidadoFila>(`/inventario/stock/consolidado?${sp.toString()}`, {}, centro);
}
