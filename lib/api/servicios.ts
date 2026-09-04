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
// NOTA: `cambios` (y sus `antes`/`despues`), y `actualizados`, NO están en el mapa BE → llegan en español.
export interface ServicioActualizadoPorCentro {
  id: string;
  clinicId: string | null;
  cambios: Record<string, { antes: unknown; despues: unknown }>;
}
export interface UpdateServicioPorClaveResult {
  slug: string;
  actualizados: ServicioActualizadoPorCentro[];
}

// Edición MULTICENTRO por clave — endpoint CORRECTO para "Todos los centros" (NO iterar updateServicio
// por centro). `active` NO va aquí (encender/apagar es por centro). RBAC: admin / servicios.multicentro
// (el BE es la autoridad). PUT /api/v2/services/slug-by/:slug.
export function updateServicioPorClave(
  clave: string,
  payload: UpdateServicioPorClavePayload,
  centroId?: string,
): Promise<UpdateServicioPorClaveResult> {
  return apiFetch<UpdateServicioPorClaveResult>(
    `/services/slug-by/${encodeURIComponent(clave)}`,
    { method: "PUT", body: JSON.stringify(payload) },
    centroId,
  );
}

// Columnas POR SERVICIO (cada pestaña del Frontdesk tiene las suyas — no se aplican a todos):
// GET = columnas efectivas del servicio (resueltas); POST = componer una columna del catálogo en ESTE
// servicio ({columnId, sortOrder, visible, pinned, active}).
export type ServicioColumna = {
  slug: string;
  labelKey: string;
  type: string;
  binding: string;
  editable: boolean;
  permissionSlug: string | null;
  render: Record<string, unknown> | null;
  sortOrder: number;
  pinned: boolean;
  color: string | null;
};
export type ComponerColumnaPayload = components["schemas"]["ComponerColumnaDto"];
export async function getServicioColumnas(servicioId: string, centroId?: string): Promise<ServicioColumna[]> {
  return asArray<ServicioColumna>(await apiFetch(`/services/${servicioId}/columns`, {}, centroId));
}
export function componerServicioColumna(
  servicioId: string,
  payload: ComponerColumnaPayload,
  centroId?: string,
): Promise<unknown> {
  return apiFetch(
    `/services/${servicioId}/columns`,
    { method: "POST", body: JSON.stringify(payload) },
    centroId,
  );
}

// Grupos de facturación (ancla CORRECTA del servicio): servicio↔grupo 1:1; cualquier producto del grupo
// cuenta para paquetes/disponibilidad y la DOSIS sale de los productos del grupo (no un producto fijo).
export type GrupoFacturacion = components["schemas"]["GrupoFacturacionEntity"];
export async function getGruposFacturacion(centroId?: string): Promise<GrupoFacturacion[]> {
  return asArray<GrupoFacturacion>(await apiFetch(`/billing/columns/groups`, {}, centroId));
}

// Los servicios son POR CENTRO (fila propia por clínica). centroId opcional = X-Tenant-ID explícito;
// sin él aplica el centro activo (cookie). includeInactive=true (config) trae TAMBIÉN los apagados para
// poder reactivarlos con el switch — el Frontdesk usa el default (solo activos).
export async function getServicios(
  centroId?: string,
  opts: { includeInactive?: boolean } = {},
): Promise<Servicio[]> {
  const qs = opts.includeInactive ? `?includeInactive=true` : "";
  return asArray<Servicio>(await apiFetch(`/services${qs}`, {}, centroId));
}

// Crear un servicio = crear una PESTAÑA. El BE le pone las columnas por defecto → nace
// usable. El FE NO compone columnas tras crear (solo POST /services/:id/columns si el
// negocio quiere ajustarlas más tarde — fuera de este flujo).
export function createServicio(payload: CreateServicioPayload, centroId?: string): Promise<Servicio> {
  return apiFetch<Servicio>(
    `/services`,
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
    `/services/${id}`,
    { method: "PUT", body: JSON.stringify(payload) },
    centroId,
  );
}
export function deleteServicio(id: string, centroId?: string): Promise<void> {
  return apiFetch<void>(`/services/${id}`, { method: "DELETE" }, centroId);
}

// Un campo de `formActions.fields`: qué se exige y DÓNDE vive su valor.
// `binding` presente → el valor vive en la entidad/paquete (no en el form); ausente → se captura en el form.
// NOTA: `fields` (antes `campos`) es una BOLSA OPACA del motor de forms → sus claves internas NO se
// traducen (llegan en español: clave/tipo/requerido/en/opciones).
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
  fields?: ServicioCampo[];
  reports?: unknown[];
  additional_actions?: unknown[];
  [k: string]: unknown;
};

// FUENTE DEL REQUISITO — dónde vive el valor que SATISFACE un requisito (sesión/personal/paquete).
// Distinto del "origen de lectura" (columnas del tablero) y del "destino de escritura"
// (celdas editables). GET /services/catalogs/requirement-sources.
export type FuenteRequisito = { binding: string; labelKey: string; group: string };
export async function getFuentesRequisito(centroId?: string): Promise<FuenteRequisito[]> {
  return asArray<FuenteRequisito>(await apiFetch(`/services/catalogs/requirement-sources`, {}, centroId));
}

// Alcance de una config: "centro" (por defecto, solo el centro activo) o "todos" (exige admin;
// aplica a TODOS los centros y devuelve qué cambió y dónde). Se manda en el cuerpo del PUT como `scope`
// (mapa BE: alcance → scope).
export type Alcance = "centro" | "todos";
export function updateServicioConAlcance(
  id: string,
  payload: UpdateServicioPayload,
  alcance: Alcance,
  centroId?: string,
): Promise<Servicio | UpdateServicioPorClaveResult> {
  return apiFetch<Servicio | UpdateServicioPorClaveResult>(
    `/services/${id}`,
    { method: "PUT", body: JSON.stringify({ ...payload, scope: alcance }) },
    centroId,
  );
}
