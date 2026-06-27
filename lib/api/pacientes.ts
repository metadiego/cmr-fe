import type { components } from "./schema";
import { apiFetch, apiFetchPaged } from "./client";
import type { Paginated } from "./types";

// Types generated from the BE Swagger (run `npm run gen:api` after BE changes).
export type Paciente = components["schemas"]["PacienteEntity"];
export type CreatePacientePayload = components["schemas"]["CreatePacienteDto"];
export type UpdatePacientePayload = components["schemas"]["UpdatePacienteDto"];

export interface ListPacientesParams {
  page?: number;
  limit?: number;
  q?: string;
}

// GET /pacientes — paginated; `q` searches name/docId/etc. Tenant-scoped by the
// active center header (handled in apiFetch).
export function listPacientes(
  params: ListPacientesParams = {},
): Promise<Paginated<Paciente>> {
  const { page = 1, limit = 20, q } = params;
  const sp = new URLSearchParams({ page: String(page), limit: String(limit) });
  if (q?.trim()) sp.set("q", q.trim());
  return apiFetchPaged<Paciente>(`/pacientes?${sp.toString()}`);
}

export function getPaciente(id: string): Promise<Paciente> {
  return apiFetch<Paciente>(`/pacientes/${id}`);
}

// Writes are tenant-scoped: the BE needs the target center. Pass `centroId` to
// override the active-center header for this request (required for master /
// multi-center users who have no auto-locked center).
export function createPaciente(
  payload: CreatePacientePayload,
  centroId?: string,
): Promise<Paciente> {
  return apiFetch<Paciente>(`/pacientes`, {
    method: "POST",
    body: JSON.stringify(payload),
    headers: centroId ? { "X-Tenant-ID": centroId } : undefined,
  });
}

export function updatePaciente(
  id: string,
  payload: UpdatePacientePayload,
  centroId?: string,
): Promise<Paciente> {
  return apiFetch<Paciente>(`/pacientes/${id}`, {
    method: "PUT",
    body: JSON.stringify(payload),
    headers: centroId ? { "X-Tenant-ID": centroId } : undefined,
  });
}

// Soft-delete: the BE sets activo=false (clinical history is kept) and the
// patient drops out of the list. Reactivate with updatePaciente(id,{activo:true}).
export function deletePaciente(id: string, centroId?: string): Promise<void> {
  return apiFetch<void>(`/pacientes/${id}`, {
    method: "DELETE",
    headers: centroId ? { "X-Tenant-ID": centroId } : undefined,
  });
}
