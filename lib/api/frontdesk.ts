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
