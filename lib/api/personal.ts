import type { components } from "./schema";
import { apiFetchPaged } from "./client";
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

// Doctors available to be assigned to appointments (capacidad = "medico").
export async function getMedicos(): Promise<Personal[]> {
  const { items } = await listPersonal({ capacidad: "medico", limit: 100 });
  return items;
}
