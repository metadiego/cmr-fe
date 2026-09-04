import { apiFetch } from "./client";

// Series de numeración por centro (BE): `default` (facturas), `devolucion`, `presupuesto`, cada una con
// `prefix`, `padding` y `nextNumber` (solo lectura: moverlo abre huecos o repite un correlativo). Editar el
// prefijo/padding: admin, super_admin, gerente; exige centro elegido. Handoff imprimir-presupuesto (§3).
// Extraído de facturas.ts para respetar el techo de tamaño (max-lines); se re-exporta desde ahí.
export interface SerieNumeracion {
  id: string;
  series: string;
  prefix?: string | null;
  padding?: number | null;
  nextNumber?: number | null;
}
export function getSeriesNumeracion(centroId?: string): Promise<SerieNumeracion[]> {
  return apiFetch<SerieNumeracion[]>(`/invoices/series`, {}, centroId);
}
export function actualizarSerieNumeracion(
  serie: string,
  payload: { prefix?: string | null; padding?: number },
  centroId?: string,
): Promise<SerieNumeracion> {
  return apiFetch<SerieNumeracion>(`/invoices/series/${encodeURIComponent(serie)}`, {
    method: "PUT",
    body: JSON.stringify(payload),
  }, centroId);
}
// Fijar el SIGUIENTE número de una serie (arranque). Solo avanzar: el BE rechaza retroceder
// (labelKey numeracion.error.arranque_retrocede). `motivo` es OBLIGATORIO (queda en el rastro).
// Permiso propio: numeracion.arranque. Handoff qa-2026-09-03-lo-que-cambia-para-el-fe (§5).
// Ruta v2: `/invoices/series/:series/start`. La clave `arranque` NO está en el mapa api-ingles → se
// envía tal cual (el DTO la espera en español); `motivo`→`reason` sí se traduce.
export function establecerArranqueSerie(
  serie: string,
  payload: { arranque: number; motivo: string },
  centroId?: string,
): Promise<SerieNumeracion> {
  return apiFetch<SerieNumeracion>(`/invoices/series/${encodeURIComponent(serie)}/start`, {
    method: "PUT",
    body: JSON.stringify({ arranque: payload.arranque, reason: payload.motivo }),
  }, centroId);
}
