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

export async function getServicios(): Promise<Servicio[]> {
  return asArray<Servicio>(await apiFetch(`/servicios`));
}

// Crear un servicio = crear una PESTAÑA. El BE le pone las columnas por defecto → nace
// usable. El FE NO compone columnas tras crear (solo POST /servicios/:id/columnas si el
// negocio quiere ajustarlas más tarde — fuera de este flujo).
export function createServicio(payload: CreateServicioPayload): Promise<Servicio> {
  return apiFetch<Servicio>(`/servicios`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}
export function updateServicio(
  id: string,
  payload: UpdateServicioPayload,
): Promise<Servicio> {
  return apiFetch<Servicio>(`/servicios/${id}`, {
    method: "PUT",
    body: JSON.stringify(payload),
  });
}
export function deleteServicio(id: string): Promise<void> {
  return apiFetch<void>(`/servicios/${id}`, { method: "DELETE" });
}
