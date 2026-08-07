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
export type Cajero = components["schemas"]["CajeroDto"];

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
  // ---- Pie del cuadre (BE 2026-08-06): lo que se entrega a contabilidad. ----
  // Documentos del día: una línea por factura. `formaPago` viene YA resuelta en siglas (p.ej. "EF+VISA")
  // — pintar tal cual, no calcular. `record` puede venir null (paciente sin número → celda vacía).
  documentos?: Array<{
    id: string;
    numero: string | null;
    pacienteId?: string | null;
    paciente: string | null;
    record: string | null;
    formaPago: string | null;
    total: number;
    estado: string;
  }>;
  // Devoluciones del día con su detalle (bloque aparte, en rojo). `numero` = nº de nota de crédito.
  devolucionesDetalle?: Array<{
    id: string;
    numero: number | string | null;
    facturaId: string | null;
    montoDevuelto: number;
    motivo: string | null;
  }>;
  // Conteo de efectivo SELLADO del día (hoja del legado): denominaciones de mayor a menor + total.
  // `cuadreId`/`usuarioId` null = SUMA de las cajas del día (consolidado). `null` = aún sin contar (o
  // el admin ve varios centros a la vez, donde sumar cajas no significa nada) → "sin conteo todavía".
  conteoEfectivo?: {
    cuadreId: string | null;
    usuarioId: string | null;
    estado?: string;
    fondoInicial: number;
    total: number;
    cajeros: number;
    lineas: Array<{ denominacionId?: string; valor: number; cantidad: number; monto: number }>;
  } | null;
  // Bloque tributario (lo mira contabilidad). Tres partidas con las mismas columnas + las facturas
  // EXONERADAS (producto gravable al que se le quitó el IVU — decisión que hay que ver). NO recalcular
  // en el cliente: los números salen calzados del BE. Handoff HANDOFF-pie-del-cuadre.
  tributario?: {
    gravado: TributarioPartida;
    exento: TributarioPartida;
    exonerado: TributarioPartida;
    facturasExoneradas: string[]; // ids de factura → se cruzan con `documentos` para el nº
  };
}
// Una partida tributaria: monto facturado, descuento, base imponible, impuesto y nº de líneas.
export interface TributarioPartida {
  monto: number;
  descuento: number;
  base: number;
  impuesto: number;
  lineas: number;
}

// ---- catálogos (CC1) ------------------------------------------------
export function getDenominaciones(monedaId?: string): Promise<Denominacion[]> {
  const q = monedaId ? `?monedaId=${encodeURIComponent(monedaId)}` : "";
  return apiFetch<Denominacion[]>(`/caja/denominaciones${q}`);
}

export function getGruposMetodoPago(): Promise<GrupoMetodoPago[]> {
  return apiFetch<GrupoMetodoPago[]>(`/caja/grupos`);
}

// Roster de cajeros del centro (auth user id + nombre). El BE aplica el alcance por rol: gerencia
// ve todos; un cajero solo a sí mismo. Puebla el selector con nombres reales (no UUID).
export function getCajeros(q?: string): Promise<Cajero[]> {
  const qs = q ? `?q=${encodeURIComponent(q)}` : "";
  return apiFetch<Cajero[]>(`/caja/cajeros${qs}`);
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
