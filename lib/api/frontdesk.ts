import type { components } from "./schema";
import { apiFetch } from "./client";

// Service session (frontdesk). Unlike medical citas, sessions are per-DAY
// (no hora/horaFin) — the service calendar schedules by date only.
export type Sesion = components["schemas"]["FrontdeskSesionEntity"];
export type CreateSesionPayload = components["schemas"]["CreateSesionDto"];
export type EstadoSesion = Sesion["estado"];

function asArray<T>(res: unknown): T[] {
  if (Array.isArray(res)) return res as T[];
  const items = (res as { items?: unknown } | null)?.items;
  return Array.isArray(items) ? (items as T[]) : [];
}

// GET /frontdesk/sesiones?desde&hasta&servicioId?&tecnicoId? — flat array (NOT
// paginated) of sessions in the range; for the month calendar.
export async function listSesionesRango(params: {
  desde: string;
  hasta: string;
  servicioId?: string;
  tecnicoId?: string;
}): Promise<Sesion[]> {
  const sp = new URLSearchParams({ desde: params.desde, hasta: params.hasta });
  if (params.servicioId) sp.set("servicioId", params.servicioId);
  if (params.tecnicoId) sp.set("tecnicoId", params.tecnicoId);
  return asArray<Sesion>(await apiFetch(`/frontdesk/sesiones?${sp.toString()}`));
}

export function getSesion(id: string): Promise<Sesion> {
  return apiFetch<Sesion>(`/frontdesk/sesiones/${id}`);
}

// POST /frontdesk/sesiones — schedule a service session on a date (no time).
export function crearSesion(
  payload: CreateSesionPayload,
  centroId?: string,
): Promise<Sesion> {
  return apiFetch<Sesion>(`/frontdesk/sesiones`, {
    method: "POST",
    body: JSON.stringify(payload),
    headers: centroId ? { "X-Tenant-ID": centroId } : undefined,
  });
}

// ——— Vista diaria del frontdesk (F4) — ver docs/plans/fe-frontdesk-dia.md ———

// Proyección del día por servicio: columnas efectivas del tablero + filas ya resueltas por el BE
// ({ id, <clave de columna>: valor }). El FE NO recalcula; solo pinta.
export type FrontdeskColumna = {
  clave: string;
  labelKey: string;
  tipo: string;
  binding: string;
  editable: boolean;
  permiso: string | null;
  render: Record<string, unknown> | null;
  orden: number;
  fijo: boolean;
  color: string | null;
};
export type FrontdeskFila = { id: string } & Record<string, unknown>;
export type FrontdeskTablero = { columnas: FrontdeskColumna[]; filas: FrontdeskFila[] };

export function getFrontdeskTablero(
  servicio: string,
  fecha: string,
  centroId?: string,
): Promise<FrontdeskTablero> {
  const sp = new URLSearchParams({ servicio, fecha });
  return apiFetch<FrontdeskTablero>(`/frontdesk/tablero?${sp.toString()}`, {}, centroId);
}

// Transiciones del flujo (sellan hora en el BE): presente → en-terapia → asistido.
export type TransicionPayload = components["schemas"]["TransicionSesionDto"];
export type TransicionClave = "presente" | "en-terapia" | "asistido";
export function marcarTransicion(
  sesionId: string,
  transicion: TransicionClave,
  payload: TransicionPayload = {},
  centroId?: string,
): Promise<Sesion> {
  return apiFetch<Sesion>(
    `/frontdesk/sesiones/${sesionId}/${transicion}`,
    { method: "POST", body: JSON.stringify(payload) },
    centroId,
  );
}

export function cancelarSesion(sesionId: string, motivo: string, centroId?: string): Promise<Sesion> {
  return apiFetch<Sesion>(
    `/frontdesk/sesiones/${sesionId}/cancelar`,
    { method: "POST", body: JSON.stringify({ motivo }) },
    centroId,
  );
}

// Reparación admin (RBAC): corrige estado/cantidad/producto con motivo auditable.
export type RepararSesionPayload = components["schemas"]["RepararSesionDto"];
export function repararSesion(
  sesionId: string,
  payload: RepararSesionPayload,
  centroId?: string,
): Promise<Sesion> {
  return apiFetch<Sesion>(
    `/frontdesk/sesiones/${sesionId}/reparar`,
    { method: "POST", body: JSON.stringify(payload) },
    centroId,
  );
}

// Guardar datos de la sesión (columnas medición, PR #136): merge sobre sesion.datos; el BE valida rango.
export function guardarDatosSesion(
  sesionId: string,
  datos: Record<string, unknown>,
  centroId?: string,
): Promise<Sesion> {
  return apiFetch<Sesion>(
    `/frontdesk/sesiones/${sesionId}/acciones`,
    { method: "POST", body: JSON.stringify({ datos }) },
    centroId,
  );
}

// Disponibilidad del paciente para el GRUPO del servicio (PR #134): paquetes pendientes + saldo total.
export type DisponibilidadServicio = {
  paquetes: {
    facturaItemId?: string;
    productoNombre?: string | null;
    total?: number;
    entregadas?: number;
    pendientes?: number;
  }[];
  pendienteTotal: number;
};
export function getDisponibilidadServicio(
  servicioId: string,
  pacienteId: string,
  centroId?: string,
): Promise<DisponibilidadServicio> {
  return apiFetch<DisponibilidadServicio>(
    `/frontdesk/servicios/${servicioId}/disponibilidad?pacienteId=${encodeURIComponent(pacienteId)}`,
    {},
    centroId,
  );
}

// Estatus de enfermeras del día (triage/vitales): actuales + catálogo de tipos (color/labelKey).
// NOTA: el POST de set no tiene DTO en Swagger (gap BE) → panel read-only por ahora.
export type NurseStatusTipo = components["schemas"]["NurseStatusTipoEntity"];
export type NurseStatusActual = {
  personalId: string;
  personalNombre?: string | null;
  statusTipoId: string | null;
  fecha?: string;
};
export function getNurseStatusTipos(centroId?: string): Promise<NurseStatusTipo[]> {
  return apiFetch<NurseStatusTipo[]>(`/frontdesk/nurse-status/tipos`, {}, centroId);
}
export function getNurseStatusActuales(fecha: string, centroId?: string): Promise<NurseStatusActual[]> {
  return apiFetch<NurseStatusActual[]>(`/frontdesk/nurse-status?fecha=${fecha}`, {}, centroId);
}
