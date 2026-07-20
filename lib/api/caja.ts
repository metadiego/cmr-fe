import type { components } from "./schema";
import { apiFetch } from "./client";

// Caja / Cuadre (BE módulo `caja`). Tenant-scoped: el X-Tenant-ID lo adjunta client.ts desde el
// centro activo. TODO el I/O de caja pasa por aquí (API-First). Los tipos de catálogo/DTO salen del
// schema OpenAPI; las respuestas que el BE deja sin tipar en Swagger (Record<string,never>) se tipan
// a mano AQUÍ, calcadas del código real del BE (caja.service.ts / caja-reportes.service.ts /
// facturas-reportes.service.ts) — no se asume nada. See docs/specs/2026-07-20-cuadre-caja-design.md.

export type Denominacion = components["schemas"]["DenominacionEntity"];
export type GrupoMetodoPago = components["schemas"]["GrupoMetodoPagoEntity"];
export type CuadreCaja = components["schemas"]["CuadreCajaEntity"];
export type AbrirCuadrePayload = components["schemas"]["AbrirCuadreDto"];
export type ConteoLinea = components["schemas"]["ConteoLineaDto"];
export type EmailCuadrePayload = components["schemas"]["EmailCuadreDto"];
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

// Fila de método de pago (tarjetas / otros) del detalle. clave estable + nombre del catálogo.
export interface DetalleMetodoRow {
  clave: string;
  nombre: string;
  cantidad: number;
  monto: number;
}

// Reporte del día (caja-reportes.service.ts → reporteDia). Fuente principal de la pantalla.
export interface ReporteDia {
  fecha: string;
  division: CajaDivision | null;
  usuarioId: string | null;
  ventas: {
    desde: string;
    hasta: string;
    facturas: number;
    bruto: number;
    devuelto: number;
    neto: number;
    porEstado: Record<string, number>;
    porMedio: Record<string, number>;
  };
  devoluciones: { cantidad: number; total: number };
  anulaciones: { cantidad: number; total: number };
  porMetodo: Record<string, number>;
  porGrupo: Record<string, number>;
  // Solo viene cuando se pasa `division`. Incluye nombre resuelto por el BE.
  porCajero?: Array<{ usuarioId: string | null; nombre: string | null; total: number }>;
  detalle: {
    efectivo: { cantidad: number; monto: number };
    tarjetas: DetalleMetodoRow[];
    otros: DetalleMetodoRow[];
    totalTarjetas: number;
    totalOtros: number;
    totalElectronicas: number;
    total: number;
  };
  pendientes: Array<{
    id: string;
    numero: string | null;
    fecha: string | null;
    pacienteId: string;
    total: number;
    montoAbonado: number;
    pendiente: number;
  }>;
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
  division: CajaDivision,
  usuarioId?: string | null,
): Promise<ReporteDia> {
  const sp = new URLSearchParams({ fecha, division });
  if (usuarioId != null) sp.set("usuarioId", usuarioId);
  return apiFetch<ReporteDia>(`/caja/reportes/dia?${sp.toString()}`);
}

// ---- cuadre (CC2) ---------------------------------------------------
// Lista cuadres para seleccionar/ver anteriores (alcance por rol lo aplica el BE).
export function listarCuadres(filtros: {
  fecha?: string;
  division?: CajaDivision;
  usuarioId?: string;
  estado?: "abierto" | "cerrado";
}): Promise<CuadreCaja[]> {
  const sp = new URLSearchParams();
  if (filtros.fecha) sp.set("fecha", filtros.fecha);
  if (filtros.division) sp.set("division", filtros.division);
  if (filtros.usuarioId) sp.set("usuarioId", filtros.usuarioId);
  if (filtros.estado) sp.set("estado", filtros.estado);
  const qs = sp.toString();
  return apiFetch<CuadreCaja[]>(`/caja/cuadres${qs ? `?${qs}` : ""}`);
}

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

// Envía el cuadre por email (archivar/compartir). Requiere email destino.
export function enviarCuadreEmail(
  id: string,
  payload: EmailCuadrePayload,
): Promise<unknown> {
  return apiFetch<unknown>(`/caja/cuadres/${id}/email`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}
