import { apiFetch } from "./client";

// Reporte de consumo de insumos (BE PR #83). Sale del snapshot congelado de facturas emitidas
// del período/centro → refleja el consumo real por terapia. La respuesta no está tipada en el
// swagger (content vacío) → declaramos la shape del handoff (insumos-estimados-consumo-handoff-fe).
export interface ConsumoPorTerapia {
  terapiaId: string;
  terapia: string;
  cantidad: number;
}
export interface ConsumoInsumo {
  insumoId: string;
  insumo: string;
  cantidad: number;
  facturas: number;
  porTerapia: ConsumoPorTerapia[];
}

export type EstimadoFiltro = "true" | "false" | "all";

// desde/hasta = YYYY-MM-DD (requeridos). estimado default 'true'. Multi-tenant por centro (X-Tenant-ID).
export function getConsumoInsumos(
  params: { desde: string; hasta: string; estimado?: EstimadoFiltro },
  centroId?: string,
): Promise<ConsumoInsumo[]> {
  const sp = new URLSearchParams({ desde: params.desde, hasta: params.hasta });
  if (params.estimado) sp.set("estimado", params.estimado);
  return apiFetch<ConsumoInsumo[]>(`/facturacion/reportes/consumo-insumos?${sp.toString()}`, {}, centroId);
}
