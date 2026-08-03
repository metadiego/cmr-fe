import type { components } from "./schema";
import { apiFetch } from "./client";

// A service tab (Láser, Vit C, …) with its color/icon. Drives the Servicios
// calendar tabs/filter and event colors.
export type Servicio = components["schemas"]["ServicioEntity"];

function asArray<T>(res: unknown): T[] {
  if (Array.isArray(res)) return res as T[];
  const items = (res as { items?: unknown } | null)?.items;
  return Array.isArray(items) ? (items as T[]) : [];
}

export type CreateServicioPayload = components["schemas"]["CreateServicioDto"];
export type UpdateServicioPayload = components["schemas"]["UpdateServicioDto"];
export type UpdateServicioPorClavePayload = components["schemas"]["UpdateServicioPorClaveDto"];

// Diff por centro que devuelve la edición "Todos los centros" (BE 2026-07-30). El BE aplica los
// cambios a la fila del servicio de CADA centro (misma clave) y devuelve, por centro, qué cambió.
export interface ServicioActualizadoPorCentro {
  id: string;
  clinicId: string | null;
  cambios: Record<string, { antes: unknown; despues: unknown }>;
}
export interface UpdateServicioPorClaveResult {
  clave: string;
  actualizados: ServicioActualizadoPorCentro[];
}

// Edición MULTICENTRO por clave — endpoint CORRECTO para "Todos los centros" (NO iterar updateServicio
// por centro). `activo` NO va aquí (encender/apagar es por centro). RBAC: admin / servicios.multicentro
// (el BE es la autoridad). PUT /api/v1/servicios/por-clave/:clave.
export function updateServicioPorClave(
  clave: string,
  payload: UpdateServicioPorClavePayload,
  centroId?: string,
): Promise<UpdateServicioPorClaveResult> {
  return apiFetch<UpdateServicioPorClaveResult>(
    `/servicios/por-clave/${encodeURIComponent(clave)}`,
    { method: "PUT", body: JSON.stringify(payload) },
    centroId,
  );
}

// Columnas POR SERVICIO (cada pestaña del Frontdesk tiene las suyas — no se aplican a todos):
// GET = columnas efectivas del servicio (resueltas); POST = componer una columna del catálogo en ESTE
// servicio ({columnaId, orden, visible, fijo, activo}).
export type ServicioColumna = {
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
export type ComponerColumnaPayload = components["schemas"]["ComponerColumnaDto"];
export async function getServicioColumnas(servicioId: string, centroId?: string): Promise<ServicioColumna[]> {
  return asArray<ServicioColumna>(await apiFetch(`/servicios/${servicioId}/columnas`, {}, centroId));
}
export function componerServicioColumna(
  servicioId: string,
  payload: ComponerColumnaPayload,
  centroId?: string,
): Promise<unknown> {
  return apiFetch(
    `/servicios/${servicioId}/columnas`,
    { method: "POST", body: JSON.stringify(payload) },
    centroId,
  );
}

// Grupos de facturación (ancla CORRECTA del servicio): servicio↔grupo 1:1; cualquier producto del grupo
// cuenta para paquetes/disponibilidad y la DOSIS sale de los productos del grupo (no un producto fijo).
export type GrupoFacturacion = components["schemas"]["GrupoFacturacionEntity"];
export async function getGruposFacturacion(centroId?: string): Promise<GrupoFacturacion[]> {
  return asArray<GrupoFacturacion>(await apiFetch(`/facturacion/columnas/grupos`, {}, centroId));
}

// Los servicios son POR CENTRO (fila propia por clínica). centroId opcional = X-Tenant-ID explícito;
// sin él aplica el centro activo (cookie). includeInactive=true (config) trae TAMBIÉN los apagados para
// poder reactivarlos con el switch — el Frontdesk usa el default (solo activos).
export async function getServicios(
  centroId?: string,
  opts: { includeInactive?: boolean } = {},
): Promise<Servicio[]> {
  const qs = opts.includeInactive ? `?includeInactive=true` : "";
  return asArray<Servicio>(await apiFetch(`/servicios${qs}`, {}, centroId));
}

// Crear un servicio = crear una PESTAÑA. El BE le pone las columnas por defecto → nace
// usable. El FE NO compone columnas tras crear (solo POST /servicios/:id/columnas si el
// negocio quiere ajustarlas más tarde — fuera de este flujo).
export function createServicio(payload: CreateServicioPayload, centroId?: string): Promise<Servicio> {
  return apiFetch<Servicio>(
    `/servicios`,
    { method: "POST", body: JSON.stringify(payload) },
    centroId,
  );
}
export function updateServicio(
  id: string,
  payload: UpdateServicioPayload,
  centroId?: string,
): Promise<Servicio> {
  return apiFetch<Servicio>(
    `/servicios/${id}`,
    { method: "PUT", body: JSON.stringify(payload) },
    centroId,
  );
}
export function deleteServicio(id: string, centroId?: string): Promise<void> {
  return apiFetch<void>(`/servicios/${id}`, { method: "DELETE" }, centroId);
}

// Un campo de `formAcciones.campos`: qué se exige y DÓNDE vive su valor.
// `binding` presente → el valor vive en la entidad/paquete (no en el form); ausente → se captura en el form.
export type ServicioCampo = {
  clave: string;
  labelKey?: string;
  tipo?: string; // texto | numero | fecha | bool | select
  requerido?: boolean;
  en?: string; // acción donde se exige (p. ej. "asistido")
  binding?: string; // p. ej. sesion.productoAplicadoId | disponibilidad; ausente = form
  opciones?: unknown;
};
export type ServicioFormAcciones = {
  title?: string;
  titleKey?: string;
  campos?: ServicioCampo[];
  reports?: unknown[];
  additional_actions?: unknown[];
  [k: string]: unknown;
};

// FUENTE DEL REQUISITO — dónde vive el valor que SATISFACE un requisito (sesión/personal/paquete).
// Distinto del "origen de lectura" (columnas del tablero) y del "destino de escritura"
// (celdas editables). GET /servicios/catalogos/fuentes-requisito.
export type FuenteRequisito = { binding: string; labelKey: string; grupo: string };
export async function getFuentesRequisito(centroId?: string): Promise<FuenteRequisito[]> {
  return asArray<FuenteRequisito>(await apiFetch(`/servicios/catalogos/fuentes-requisito`, {}, centroId));
}

// Alcance de una config: "centro" (por defecto, solo el centro activo) o "todos" (exige admin;
// aplica a TODOS los centros y devuelve qué cambió y dónde). Se manda en el cuerpo del PUT.
export type Alcance = "centro" | "todos";
export function updateServicioConAlcance(
  id: string,
  payload: UpdateServicioPayload,
  alcance: Alcance,
  centroId?: string,
): Promise<Servicio | UpdateServicioPorClaveResult> {
  return apiFetch<Servicio | UpdateServicioPorClaveResult>(
    `/servicios/${id}`,
    { method: "PUT", body: JSON.stringify({ ...payload, alcance }) },
    centroId,
  );
}
