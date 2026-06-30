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

export async function getServicios(): Promise<Servicio[]> {
  return asArray<Servicio>(await apiFetch(`/servicios`));
}
