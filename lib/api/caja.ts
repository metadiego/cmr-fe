import type { components } from "./schema";
import { apiFetch } from "./client";

// Caja / Cuadre (BE módulo `caja`, CC1–CC3). Tenant-scoped: el X-Tenant-ID lo adjunta client.ts
// desde el centro activo. TODO el I/O de caja pasa por aquí (API-First). Los tipos salen del
// schema OpenAPI; las respuestas que el BE deja sin tipar en Swagger (Record<string,never>) se
// tipan a mano AQUÍ, calcadas del código real del BE (caja.service.ts / caja-reportes.service.ts) —
// no se asume nada. See docs/specs/2026-07-20-cuadre-caja-design.md.

export type Denominacion = components["schemas"]["DenominacionEntity"];
export type GrupoMetodoPago = components["schemas"]["GrupoMetodoPagoEntity"];
export type CuadreCaja = components["schemas"]["CuadreCajaEntity"];
export type AbrirCuadrePayload = components["schemas"]["AbrirCuadreDto"];
export type ConteoLinea = components["schemas"]["ConteoLineaDto"];
export type CajaDivision = "consulta" | "general";

// Línea de conteo persistida (getById devuelve CuadreCajaEntity + conteo[]). El BE no la tipa en
// Swagger; se refleja la entidad `cuadre_conteo`.
export interface CuadreConteo {
  id: string;
  cuadreId: string;
  denominacionId: string;
  cantidad: number;
}

// Cuadre con su conteo (respuesta de getById/contar/cerrar). `totalesPorMetodo` es el snapshot
// (clave de forma de pago → monto neto) que el BE sella al cerrar.
export type CuadreConItems = Omit<CuadreCaja, "totalesPorMetodo"> & {
  totalesPorMetodo: Record<string, number> | null;
  conteo: CuadreConteo[];
};

// Reporte del día (caja-reportes.service.ts → reporteDia). `porCajero` solo viene con `division`.
export interface ReporteDia {
  fecha: string;
  division: CajaDivision | null;
  usuarioId: string | null;
  ventas: unknown;
  devoluciones: unknown;
  anulaciones: unknown;
  porMetodo: Record<string, number>;
  porGrupo: Record<string, number>;
  porCajero?: Array<{ usuarioId: string | null; total: number }>;
}

// ---- catálogos (CC1) ------------------------------------------------
export function getDenominaciones(monedaId?: string): Promise<Denominacion[]> {
  const q = monedaId ? `?monedaId=${encodeURIComponent(monedaId)}` : "";
  return apiFetch<Denominacion[]>(`/caja/denominaciones${q}`);
}

export function getGruposMetodoPago(): Promise<GrupoMetodoPago[]> {
  return apiFetch<GrupoMetodoPago[]>(`/caja/grupos`);
}

// ---- reporte del día (CC3) ------------------------------------------
// `division` separa consulta/general; `usuarioId` acota a un cajero (undefined = alcance por rol
// que resuelve el BE). Un cajero solo verá el suyo; gerencia puede pasar otro id o null (consolidado).
export function getReporteDia(
  fecha: string,
  division?: CajaDivision,
  usuarioId?: string | null,
): Promise<ReporteDia> {
  const sp = new URLSearchParams({ fecha });
  if (division) sp.set("division", division);
  if (usuarioId != null) sp.set("usuarioId", usuarioId);
  return apiFetch<ReporteDia>(`/caja/reportes/dia?${sp.toString()}`);
}

// ---- cuadre (CC2) ---------------------------------------------------
// Abre o RETOMA (idempotente en el BE) el cuadre de esa (división × cajero)/día. `division`
// obligatoria. `usuarioId`: omitido = propio cajero; null = consolidado (gerencia).
export function abrirCuadre(payload: AbrirCuadrePayload): Promise<CuadreCaja> {
  return apiFetch<CuadreCaja>(`/caja/cuadres`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function getCuadre(id: string): Promise<CuadreConItems> {
  return apiFetch<CuadreConItems>(`/caja/cuadres/${id}`);
}

export function contarCuadre(
  id: string,
  conteos: ConteoLinea[],
): Promise<CuadreConItems> {
  return apiFetch<CuadreConItems>(`/caja/cuadres/${id}/conteo`, {
    method: "POST",
    body: JSON.stringify({ conteos }),
  });
}

export function cerrarCuadre(id: string): Promise<CuadreConItems> {
  return apiFetch<CuadreConItems>(`/caja/cuadres/${id}/cerrar`, {
    method: "POST",
  });
}
