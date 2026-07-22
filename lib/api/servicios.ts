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

// Grupos de facturación (ancla CORRECTA del servicio): servicio↔grupo 1:1; cualquier producto del grupo
// cuenta para paquetes/disponibilidad y la DOSIS sale de los productos del grupo (no un producto fijo).
export type GrupoFacturacion = components["schemas"]["GrupoFacturacionEntity"];
export async function getGruposFacturacion(centroId?: string): Promise<GrupoFacturacion[]> {
  return asArray<GrupoFacturacion>(await apiFetch(`/facturacion/columnas/grupos`, {}, centroId));
}

// Los servicios son POR CENTRO (fila propia por clínica). centroId opcional = X-Tenant-ID explícito;
// sin él aplica el centro activo (cookie).
export async function getServicios(centroId?: string): Promise<Servicio[]> {
  return asArray<Servicio>(await apiFetch(`/servicios`, {}, centroId));
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
