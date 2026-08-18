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

// Ventas por GRUPO (reporte de gerencia, BE en prod). Mide MOVIMIENTO de producto por grupo de
// facturación (no dinero de caja). Regla dura del dueño: el total de las facturas es la verdad, y el
// desglose por grupo debe cuadrar EXACTAMENTE → la respuesta trae `cuadre` y la pantalla lo muestra.
// Los kits NO son grupo propio: su dinero se reparte a los grupos de sus componentes. Los importes
// vienen redondeados por el BE: NO recalcular en el FE (recalcular puede romper el cuadre). Permiso
// reportes.grupo.read. Handoff HANDOFF-ventas-por-grupo.
export type DivisionReporte = "general" | "consulta";
export interface ReporteGrupoFila {
  grupoId: string | null; // null en 'sin_clasificar' → NO usar como key de React (usar `clave`)
  clave: string;
  labelKey: string;
  megagrupoClave?: string | null;
  facturado: number;
  descuento: number;
  devoluciones: number;
  impuesto: number;
  envio: number;
  neto: number;
  facturas: number;
  devolucionesCount: number;
}
export interface ReporteMegagrupo {
  clave: string;
  neto: number;
  facturas: number;
}
export interface ReporteTotales {
  facturado: number;
  descuento: number;
  devoluciones: number;
  impuesto: number;
  envio: number;
  neto: number;
}
export interface ReporteCuadre {
  totalFacturas: number;
  totalDesglose: number;
  diferencia: number;
  cuadra: boolean;
}
export interface ReportePorGrupo {
  desde: string;
  hasta: string;
  grupos: ReporteGrupoFila[]; // ya ordenados por neto desc — NO reordenar
  megagrupos: ReporteMegagrupo[];
  totales: ReporteTotales;
  cuadre: ReporteCuadre;
}
export function getReportePorGrupo(
  params: { desde: string; hasta: string; contexto?: DivisionReporte },
  centroId?: string,
): Promise<ReportePorGrupo> {
  const sp = new URLSearchParams({ desde: params.desde, hasta: params.hasta });
  if (params.contexto) sp.set("contexto", params.contexto); // omitido = las dos divisiones
  return apiFetch<ReportePorGrupo>(`/facturacion/reportes/por-grupo?${sp.toString()}`, {}, centroId);
}
