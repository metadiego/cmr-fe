import type { components } from "./schema";
import { apiFetch, apiFetchPaged } from "./client";
import type { Paginated } from "./types";

// Staff member. `capacidades` includes role-like tags (e.g. "medico") used to
// filter who can be assigned to an appointment.
export type Personal = components["schemas"]["PersonalEntity"];

export interface ListPersonalParams {
  page?: number;
  limit?: number;
  q?: string;
  capacidad?: string;
}

export function listPersonal(
  params: ListPersonalParams = {},
): Promise<Paginated<Personal>> {
  const { page = 1, limit = 50, q, capacidad } = params;
  const sp = new URLSearchParams({ page: String(page), limit: String(limit) });
  if (q?.trim()) sp.set("q", q.trim());
  if (capacidad) sp.set("capacidad", capacidad);
  return apiFetchPaged<Personal>(`/personal?${sp.toString()}`);
}

// Roster por CAPACIDAD (enfermera/tecnico/medico…), agnóstico al tablero: GET /personal/por-capacidad/:cap.
// Alimenta el selector de enfermera del modal de Notificar aunque la columna fd_enfermera NO esté
// colocada en ese tablero (p. ej. Atención). Devuelve {id, nombre, apellido}. Verificado en prod.
export interface PersonalPorCapacidad {
  id: string;
  nombre: string;
  apellido?: string | null;
}
export function listPersonalPorCapacidad(capacidad: string, centro?: string): Promise<PersonalPorCapacidad[]> {
  return apiFetch<PersonalPorCapacidad[]>(`/personal/por-capacidad/${encodeURIComponent(capacidad)}`, {}, centro);
}

// Doctors available to be assigned to appointments (capacidad = "medico").
export async function getMedicos(): Promise<Personal[]> {
  const { items } = await listPersonal({ capacidad: "medico", limit: 100 });
  return items;
}
