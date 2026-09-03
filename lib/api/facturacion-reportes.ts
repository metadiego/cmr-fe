import { apiFetch } from "./client";

// Reporte de consumo de insumos (BE PR #83). Sale del snapshot congelado de facturas emitidas
// del período/centro → refleja el consumo real por terapia. La respuesta no está tipada en el
// swagger (content vacío) → declaramos la shape del handoff (insumos-estimados-consumo-handoff-fe).
// `terapiaId`/`terapia`/`insumoId`/`insumo`/`porTerapia` NO están en el mapa api-ingles → el BE las
// deja en español; `cantidad`→`quantity` y `facturas`→`invoices` (nº de facturas) sí se traducen.
export interface ConsumoPorTerapia {
  terapiaId: string;
  terapia: string;
  quantity: number;
}
export interface ConsumoInsumo {
  insumoId: string;
  insumo: string;
  quantity: number;
  invoices: number;
  porTerapia: ConsumoPorTerapia[];
}

export type EstimadoFiltro = "true" | "false" | "all";

// from/to = YYYY-MM-DD (requeridos). estimated default 'true'. Multi-tenant por centro (X-Tenant-ID).
export function getConsumoInsumos(
  params: { from: string; to: string; estimated?: EstimadoFiltro },
  centroId?: string,
): Promise<ConsumoInsumo[]> {
  const sp = new URLSearchParams({ from: params.from, to: params.to });
  if (params.estimated) sp.set("estimated", params.estimated);
  return apiFetch<ConsumoInsumo[]>(`/billing/reports/supplies-consumption?${sp.toString()}`, {}, centroId);
}

// Ventas por GRUPO (reporte de gerencia, BE en prod). Mide MOVIMIENTO de producto por grupo de
// facturación (no dinero de caja). Regla dura del dueño: el total de las facturas es la verdad, y el
// desglose por grupo debe cuadrar EXACTAMENTE → la respuesta trae `reconciliation` y la pantalla lo muestra.
// Los kits NO son grupo propio: su dinero se reparte a los grupos de sus componentes. Los importes
// vienen redondeados por el BE: NO recalcular en el FE (recalcular puede romper el cuadre). Permiso
// reportes.grupo.read. Handoff HANDOFF-ventas-por-grupo.
// Claves NO traducidas por el BE (no están en el mapa api-ingles): grupoId, megagrupoClave, facturado,
// neto, grupos, megagrupos, totalFacturas, totalDesglose, cuadra, devolucionesCount.
export type DivisionReporte = "general" | "consulta";
export interface ReporteGrupoFila {
  grupoId: string | null; // null en 'sin_clasificar' → NO usar como key de React (usar `slug`)
  slug: string;
  labelKey: string;
  megagrupoClave?: string | null;
  facturado: number;
  discount: number;
  refunds: number;
  tax: number;
  shipping: number;
  neto: number;
  invoices: number;
  devolucionesCount: number;
}
export interface ReporteMegagrupo {
  slug: string;
  neto: number;
  invoices: number;
}
export interface ReporteTotales {
  facturado: number;
  discount: number;
  refunds: number;
  tax: number;
  shipping: number;
  neto: number;
}
export interface ReporteCuadre {
  totalFacturas: number;
  totalDesglose: number;
  difference: number;
  cuadra: boolean;
}
export interface ReportePorGrupo {
  from: string;
  to: string;
  grupos: ReporteGrupoFila[]; // ya ordenados por neto desc — NO reordenar
  megagrupos: ReporteMegagrupo[];
  totals: ReporteTotales;
  reconciliation: ReporteCuadre;
}
export function getReportePorGrupo(
  params: { from: string; to: string; context?: DivisionReporte },
  centroId?: string,
): Promise<ReportePorGrupo> {
  const sp = new URLSearchParams({ from: params.from, to: params.to });
  if (params.context) sp.set("context", params.context); // omitido = las dos divisiones
  return apiFetch<ReportePorGrupo>(`/billing/reports/group-by?${sp.toString()}`, {}, centroId);
}

// Ventas por USUARIO (quién vende). Ordenado de mayor a menor. `name: null` = factura sin usuario
// responsable (importada/vieja) → se muestra como "Sin usuario", no se esconde. Totales redondeados por
// el BE (no recalcular). Permiso estadisticas.read. Handoff HANDOFF-usuario-de-la-factura-y-ventas-por-usuario.
export interface ReporteUsuarioFila {
  userId: string | null;
  name: string | null;
  total: number;
}
export function getReportePorUsuario(
  params: { from: string; to: string; context?: DivisionReporte },
  centroId?: string,
): Promise<ReporteUsuarioFila[]> {
  const sp = new URLSearchParams({ from: params.from, to: params.to });
  if (params.context) sp.set("context", params.context);
  return apiFetch<ReporteUsuarioFila[]>(`/billing/reports/user-by?${sp.toString()}`, {}, centroId);
}
