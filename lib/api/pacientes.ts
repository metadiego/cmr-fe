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

// GET /pacientes — paginated; `q` searches name/docId/etc. Tenant scope:
// `tenant` undefined → active center; a centroId string → force that center;
// null → OMIT X-Tenant-ID so the BE returns patients across ALL the user's
// centers (master "todos los centros" view — distinguish rows by clinicId).
export function listPacientes(
  params: ListPacientesParams = {},
  tenant?: string | null,
): Promise<Paginated<Paciente>> {
  const { page = 1, limit = 20, q } = params;
  const sp = new URLSearchParams({ page: String(page), limit: String(limit) });
  if (q?.trim()) sp.set("q", q.trim());
  return apiFetchPaged<Paciente>(`/pacientes?${sp.toString()}`, {}, tenant);
}

export function getPaciente(id: string, centroId?: string): Promise<Paciente> {
  return apiFetch<Paciente>(`/pacientes/${id}`, {}, centroId);
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

// Assign the next consecutive record number (`record`) for the patient's
// center (POST /pacientes/:id/asignar-record). Used when a patient has no record
// yet. Tenant-scoped: pass centroId so the BE picks the right center's sequence.
export function asignarRecord(id: string, centroId?: string): Promise<Paciente> {
  return apiFetch<Paciente>(`/pacientes/${id}/asignar-record`, {
    method: "POST",
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

// ─── Alta validada (docs/specs/paciente-alta-validada.md del BE) ─────────────
// Tipos locales hasta regenerar schema.d.ts con `npm run gen:api` (el BE debe
// estar desplegado/corriendo con los endpoints nuevos).

// Quién posee un número de récord en el centro. `dueno` null = disponible.
export interface RecordDueno {
  record: string;
  disponible: boolean;
  dueno: {
    id: string;
    nombres: string;
    apellidos: string | null;
    record: string | null;
    activo: boolean;
  } | null;
}

// GET /pacientes/record/:record — pre-chequeo de duplicidad del récord manual,
// SIEMPRE acotado al centro (el mismo número en otro centro es otra persona).
export function getRecordDueno(
  record: string,
  centroId?: string,
): Promise<RecordDueno> {
  return apiFetch<RecordDueno>(
    `/pacientes/record/${encodeURIComponent(record)}`,
    {},
    centroId,
  );
}

// Config efectiva del alta del centro: qué campos son obligatorios además de
// nombres (default del BE: telefono, zipcode, sexo; cada centro puede sobreescribir).
export function getConfigAltaPacientes(
  centroId?: string,
): Promise<{ camposObligatorios: string[] }> {
  return apiFetch<{ camposObligatorios: string[] }>(
    `/pacientes/config-alta`,
    {},
    centroId,
  );
}
