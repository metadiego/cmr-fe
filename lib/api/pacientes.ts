import type { components } from "./schema";
import { apiFetch, apiFetchPaged } from "./client";
import type { Paginated } from "./types";

// Types generated from the BE Swagger (run `npm run gen:api` after BE changes).
export type Paciente = components["schemas"]["PacienteEntity"] & { nombreMostrar?: string | null };
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

// PUT /pacientes/config-alta — define qué exige el alta. alcance: "centro" (por defecto, solo el
// centro activo) o "todos" (exige admin; aplica a todos los centros). Devuelve a qué centros aplicó.
// RBAC pacientes.config. "Datos obligatorios del paciente" ≠ "campos requeridos por servicio".
export type AltaConfigResult = {
  camposObligatorios: string[];
  alcance: "centro" | "todos";
  centros: string[];
};
export function updateConfigAltaPacientes(
  payload: { camposObligatorios: string[]; alcance?: "centro" | "todos" },
  centroId?: string,
): Promise<AltaConfigResult> {
  return apiFetch<AltaConfigResult>(
    `/pacientes/config-alta`,
    { method: "PUT", body: JSON.stringify(payload) },
    centroId,
  );
}

// --- Disponibilidad heredada del LEGADO (BE 18-ago) ---------------------------------------------
// El número de récord NO identifica a una persona: en prod hay 239 récords compartidos por >1 ficha.
// Flujo: diagnosticar por récord → si es ambiguo (409 RECORD_AMBIGUO con `candidatos`), elegir a quién
// → repetir con pacienteId → aplicar con ese mismo pacienteId. Handoff HANDOFF-record-ambiguo-elegir-persona.
// El endpoint NO está aún en el schema generado (gen:api pendiente) → se tipa aquí.
export interface CandidatoRecord {
  id: string;
  record: string;
  nombres?: string | null;
  apellidos?: string | null;
  telefono?: string | null;
  fechaNacimiento?: string | null;
  createdAt?: string | null;
}
// La forma del diagnóstico "feliz" la sirve el BE al leer el legado; se tipa laxa (hoy la nube
// devuelve 500 porque el contenedor no trae sqlcmd — solo el camino del 409 es probable en prod).
export interface DiagnosticoLegado {
  record: string;
  pacienteId?: string | null;
  paciente?: { id?: string; nombres?: string | null; apellidos?: string | null } | null;
  items?: unknown[];
  [k: string]: unknown;
}
export function diagnosticoDisponibilidadLegado(
  record: string,
  pacienteId?: string,
  centroId?: string,
): Promise<DiagnosticoLegado> {
  const qs = pacienteId ? `?pacienteId=${encodeURIComponent(pacienteId)}` : "";
  return apiFetch<DiagnosticoLegado>(
    `/pacientes/disponibilidad-legado/${encodeURIComponent(record)}/diagnostico${qs}`,
    {},
    centroId,
  );
}
export function aplicarDisponibilidadLegado(
  record: string,
  payload: { pacienteId: string; items: unknown[] },
  centroId?: string,
): Promise<unknown> {
  return apiFetch<unknown>(
    `/pacientes/disponibilidad-legado/${encodeURIComponent(record)}/aplicar`,
    { method: "POST", body: JSON.stringify(payload) },
    centroId,
  );
}

// Reporte de PREPARACIÓN del legado: a quién con cita próxima le falta cargar disponibilidad heredada.
// `estado` colorea la fila (pendiente|al_dia|sin_record|record_ambiguo|error). `omitidos`>0 = hubo más que
// el tope (decirlo, no esconderlo). Permiso factura.retroactivo. Handoff rol-multicentro-y-preparacion-legado.
export interface PreparacionFila {
  pacienteId: string;
  record?: string | null;
  nombre?: string | null;
  proximaCita?: string | null;
  estado: "pendiente" | "al_dia" | "sin_record" | "record_ambiguo" | "error" | string;
  items?: unknown[];
  candidatos?: CandidatoRecord[];
  motivo?: string | null;
}
export interface PreparacionLegado {
  desde: string;
  hasta: string;
  total: number;
  omitidos: number;
  filas: PreparacionFila[];
}
export function getPreparacionLegado(
  params: { dias?: number; limite?: number } = {},
  centroId?: string,
): Promise<PreparacionLegado> {
  const sp = new URLSearchParams();
  if (params.dias) sp.set("dias", String(params.dias));
  if (params.limite) sp.set("limite", String(params.limite));
  return apiFetch<PreparacionLegado>(`/pacientes/disponibilidad-legado/preparacion?${sp.toString()}`, {}, centroId);
}
