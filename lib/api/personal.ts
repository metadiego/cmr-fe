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

// `centroId` (opcional) fuerza el centro de ESTA lectura vía X-Tenant-ID, para el selector de centro EN
// la pantalla: el personal cuelga del centro, así que al mirar otro hay que recargarlo o se agenda con un
// médico que no está allí (p.ej. Emma/Javier de Caguas salían en Bayamón). Handoff selector-de-centro.
export function listPersonal(
  params: ListPersonalParams = {},
  centroId?: string,
): Promise<Paginated<Personal>> {
  const { page = 1, limit = 50, q, capacidad } = params;
  const sp = new URLSearchParams({ page: String(page), limit: String(limit) });
  if (q?.trim()) sp.set("q", q.trim());
  if (capacidad) sp.set("capacity", capacidad);
  return apiFetchPaged<Personal>(`/staff?${sp.toString()}`, {}, centroId);
}

// Editar la ficha: cargo + capacidades (PUT /personal/:id). Verificado en prod. Handoff
// ficha-de-personal-todo-en-una-pantalla.
export function updatePersonal(
  id: string,
  payload: { jobTitle?: string | null; capabilities?: string[] },
  centroId?: string,
): Promise<Personal> {
  return apiFetch<Personal>(`/staff/${id}`, { method: "PUT", body: JSON.stringify(payload) }, centroId);
}

// Catálogo de cargos (GET /personal/cargos) → [{ clave, labelKey }]. Ruta arreglada por el BE (antes
// colisionaba con /personal/:id). Handoff huecos-lectura-personal.
export interface CargoCatalogo {
  slug: string;
  labelKey?: string | null; // se dice igual (CAMPOS_IGUALES)
  name?: string | null;
}
export function getCargos(centroId?: string): Promise<CargoCatalogo[]> {
  return apiFetch<CargoCatalogo[]>(`/staff/job-titles`, {}, centroId);
}

// Centros de SERVICIO de una persona (LECTURA, GET /personal/:id/centros): devuelve TODOS los centros del
// sistema con un `activo` por cada uno, YA RESUELTO por el BE (incluye el caso de la ficha sin lista, que
// aparece activa en su centro de origen). El FE NO replica esa regla — pinta lo que llega. Handoff
// huecos-lectura-personal.
export interface CentroDePersonal {
  id: string;
  name: string;
  active: boolean;
}
export function getPersonalCentros(id: string, centroId?: string): Promise<CentroDePersonal[]> {
  return apiFetch<CentroDePersonal[]>(`/staff/${id}/centers`, {}, centroId);
}

// Guardar los centros ACTIVOS de la persona (PUT /personal/:id/centros { centroIds }). Se manda la lista
// de los que quedan ENCENDIDOS; el BE deja el set exactamente así.
// `centroIds` NO está en el mapa de campos → el body va tal cual (el middleware lo deja pasar al DTO).
export function updatePersonalCentros(id: string, centroIds: string[], centroId?: string): Promise<Personal> {
  return apiFetch<Personal>(`/staff/${id}/centers`, { method: "PUT", body: JSON.stringify({ centroIds }) }, centroId);
}

// Roster por CAPACIDAD (enfermera/tecnico/medico…), agnóstico al tablero: GET /personal/por-capacidad/:cap.
// Alimenta el selector de enfermera del modal de Notificar aunque la columna fd_enfermera NO esté
// colocada en ese tablero (p. ej. Atención). Devuelve {id, nombre, apellido}. Verificado en prod.
export interface PersonalPorCapacidad {
  id: string;
  name: string;
  lastName?: string | null;
}
export function listPersonalPorCapacidad(capacidad: string, centro?: string): Promise<PersonalPorCapacidad[]> {
  return apiFetch<PersonalPorCapacidad[]>(`/staff/capacity-by/${encodeURIComponent(capacidad)}`, {}, centro);
}

// Doctors available to be assigned to appointments (capacidad = "medico"). `centroId` recarga la lista
// con los médicos del centro que se está mirando (selector de centro EN la pantalla).
export async function getMedicos(centroId?: string): Promise<Personal[]> {
  const { items } = await listPersonal({ capacidad: "medico", limit: 100 }, centroId);
  return items;
}
