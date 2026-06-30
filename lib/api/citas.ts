import type { components } from "./schema";
import { apiFetch, apiFetchPaged } from "./client";
import type { Paginated } from "./types";

// Types generated from the BE Swagger (run `npm run gen:api` after BE changes).
export type Cita = components["schemas"]["CitaEntity"];
export type CreateCitaPayload = components["schemas"]["CreateCitaDto"];
export type TipoCita = components["schemas"]["TipoCitaEntity"];
export type EstadoCita = Cita["estado"];
export type CanalCita = Cita["canal"];

export const ESTADOS: EstadoCita[] = [
  "programada",
  "confirmada",
  "presente",
  "triage",
  "en_consulta",
  "atendida",
  "no_show",
  "cancelada",
  "reprogramada",
];

export interface ListCitasParams {
  page?: number;
  limit?: number;
  fecha?: string; // YYYY-MM-DD (single day)
  desde?: string;
  hasta?: string;
  medicoId?: string;
  pacienteId?: string;
  estado?: EstadoCita;
  canal?: CanalCita;
}

export function listCitas(
  params: ListCitasParams = {},
): Promise<Paginated<Cita>> {
  const { page = 1, limit = 100, ...filters } = params;
  const sp = new URLSearchParams({ page: String(page), limit: String(limit) });
  for (const [k, v] of Object.entries(filters)) {
    if (v) sp.set(k, String(v));
  }
  return apiFetchPaged<Cita>(`/citas?${sp.toString()}`);
}

export function getCita(id: string): Promise<Cita> {
  return apiFetch<Cita>(`/citas/${id}`);
}

// Writes are tenant-scoped: pass centroId to set X-Tenant-ID for this request.
export function createCita(
  payload: CreateCitaPayload,
  centroId?: string,
): Promise<Cita> {
  return apiFetch<Cita>(`/citas`, {
    method: "POST",
    body: JSON.stringify(payload),
    headers: centroId ? { "X-Tenant-ID": centroId } : undefined,
  });
}

// ---- Lifecycle transitions (slice 2: scheduling flow) ----------------------
// State machine (verified): programada →confirmar→ confirmada →presente→ presente
// →consulta→ en_consulta. triage/atender need vitals (slice 3). no-show/cancelar/
// reagendar available from the open states. All are tenant-scoped writes.

function transition<T = Cita>(
  id: string,
  action: string,
  body: Record<string, unknown> | undefined,
  centroId?: string,
): Promise<T> {
  return apiFetch<T>(`/citas/${id}/${action}`, {
    method: "POST",
    body: body ? JSON.stringify(body) : undefined,
    headers: centroId ? { "X-Tenant-ID": centroId } : undefined,
  });
}

export const confirmarCita = (id: string, centroId?: string) =>
  transition(id, "confirmar", undefined, centroId);
export const presenteCita = (id: string, centroId?: string) =>
  transition(id, "presente", undefined, centroId);
export const noShowCita = (id: string, centroId?: string) =>
  transition(id, "no-show", undefined, centroId);
export const cancelarCita = (id: string, motivo: string, centroId?: string) =>
  transition(id, "cancelar", { motivo }, centroId);
export const reagendarCita = (
  id: string,
  payload: { fecha: string; hora?: string; motivo: string },
  centroId?: string,
) => transition(id, "reagendar", payload, centroId);

// Appointment type catalog (medica / seguimiento / control, each requiereMedico).
export async function getTiposCita(): Promise<TipoCita[]> {
  const res = (await apiFetch(`/citas/tipos`)) as unknown;
  if (Array.isArray(res)) return res as TipoCita[];
  const items = (res as { items?: unknown } | null)?.items;
  return Array.isArray(items) ? (items as TipoCita[]) : [];
}
