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

// Catálogo de destinos válidos para un requerido (GET /servicios/catalogos/requeridos-bindings).
export type RequeridoBinding = { binding: string; labelKey: string; grupo: string };
export async function getRequeridosBindings(centroId?: string): Promise<RequeridoBinding[]> {
  return asArray<RequeridoBinding>(await apiFetch(`/servicios/catalogos/requeridos-bindings`, {}, centroId));
}
