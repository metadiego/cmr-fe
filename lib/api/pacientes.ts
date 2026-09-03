import type { components } from "./schema";
import { apiFetch, apiFetchPaged } from "./client";
import type { Paginated } from "./types";

// Types generated from the BE Swagger (run `npm run gen:api` after BE changes).
export type Paciente = components["schemas"]["PacienteEntity"] & { displayName?: string | null };
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
  return apiFetchPaged<Paciente>(`/patients?${sp.toString()}`, {}, tenant);
}

export function getPaciente(id: string, centroId?: string): Promise<Paciente> {
  return apiFetch<Paciente>(`/patients/${id}`, {}, centroId);
}

// Writes are tenant-scoped: the BE needs the target center. Pass `centroId` to
// override the active-center header for this request (required for master /
// multi-center users who have no auto-locked center).
export function createPaciente(
  payload: CreatePacientePayload,
  centroId?: string,
): Promise<Paciente> {
  return apiFetch<Paciente>(`/patients`, {
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
  return apiFetch<Paciente>(`/patients/${id}`, {
    method: "PUT",
    body: JSON.stringify(payload),
    headers: centroId ? { "X-Tenant-ID": centroId } : undefined,
  });
}

// Assign the next consecutive record number (`record`) for the patient's
// center (POST /pacientes/:id/asignar-record). Used when a patient has no record
// yet. Tenant-scoped: pass centroId so the BE picks the right center's sequence.
export function asignarRecord(id: string, centroId?: string): Promise<Paciente> {
  return apiFetch<Paciente>(`/patients/${id}/assign-record`, {
    method: "POST",
    headers: centroId ? { "X-Tenant-ID": centroId } : undefined,
  });
}

// Soft-delete: the BE sets activo=false (clinical history is kept) and the
// patient drops out of the list. Reactivate with updatePaciente(id,{activo:true}).
export function deletePaciente(id: string, centroId?: string): Promise<void> {
  return apiFetch<void>(`/patients/${id}`, {
    method: "DELETE",
    headers: centroId ? { "X-Tenant-ID": centroId } : undefined,
  });
}

// ─── Alta validada (docs/specs/paciente-alta-validada.md del BE) ─────────────
// Tipos locales hasta regenerar schema.d.ts con `npm run gen:api` (el BE debe
// estar desplegado/corriendo con los endpoints nuevos).

// Quién posee un número de récord en el centro. `dueno` null = disponible.
export interface RecordDueno {
  medicalRecordNumber: string;
  disponible: boolean; // NO en el mapa de campos → el BE lo devuelve en español
  dueno: {
    // `dueno` NO está en el mapa → la clave del contenedor queda en español
    id: string;
    firstName: string;
    lastName: string | null;
    medicalRecordNumber: string | null;
    active: boolean;
  } | null;
}

// GET /pacientes/record/:record — pre-chequeo de duplicidad del récord manual,
// SIEMPRE acotado al centro (el mismo número en otro centro es otra persona).
export function getRecordDueno(
  record: string,
  centroId?: string,
): Promise<RecordDueno> {
  return apiFetch<RecordDueno>(
    `/patients/record/${encodeURIComponent(record)}`,
    {},
    centroId,
  );
}

// Config efectiva del alta del centro: qué campos son obligatorios además de
// nombres (default del BE: telefono, zipcode, sexo; cada centro puede sobreescribir).
export function getConfigAltaPacientes(
  centroId?: string,
): Promise<{ requiredFields: string[] }> {
  return apiFetch<{ requiredFields: string[] }>(
    `/patients/discharge-config`,
    {},
    centroId,
  );
}

// PUT /pacientes/config-alta — define qué exige el alta. alcance: "centro" (por defecto, solo el
// centro activo) o "todos" (exige admin; aplica a todos los centros). Devuelve a qué centros aplicó.
// RBAC pacientes.config. "Datos obligatorios del paciente" ≠ "campos requeridos por servicio".
export type AltaConfigResult = {
  requiredFields: string[];
  scope: "centro" | "todos"; // valores de dato, no claves → se quedan igual
  centers: string[];
};
export function updateConfigAltaPacientes(
  payload: { requiredFields: string[]; scope?: "centro" | "todos" },
  centroId?: string,
): Promise<AltaConfigResult> {
  return apiFetch<AltaConfigResult>(
    `/patients/discharge-config`,
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
  medicalRecordNumber: string;
  firstName?: string | null;
  lastName?: string | null;
  phone?: string | null;
  dateOfBirth?: string | null;
  createdAt?: string | null;
}
// La forma del diagnóstico "feliz" la sirve el BE al leer el legado; se tipa laxa (hoy la nube
// devuelve 500 porque el contenedor no trae sqlcmd — solo el camino del 409 es probable en prod).
export interface DiagnosticoLegado {
  medicalRecordNumber: string;
  patientId?: string | null;
  patient?: { id?: string; firstName?: string | null; lastName?: string | null } | null;
  items?: unknown[];
  [k: string]: unknown;
}
export function diagnosticoDisponibilidadLegado(
  record: string,
  pacienteId?: string,
  centroId?: string,
): Promise<DiagnosticoLegado> {
  const qs = pacienteId ? `?patientId=${encodeURIComponent(pacienteId)}` : "";
  return apiFetch<DiagnosticoLegado>(
    `/patients/legacy-availability/${encodeURIComponent(record)}/diagnosis${qs}`,
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
    `/patients/legacy-availability/${encodeURIComponent(record)}/apply`,
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
// OJO: `filas` es una bolsa OPACA (el interceptor traduce la clave del contenedor a `rows` pero NO
// recorre su contenido) → las filas (PreparacionFila) conservan sus claves en español.
export interface PreparacionLegado {
  from: string;
  to: string;
  total: number;
  skipped: number;
  rows: PreparacionFila[];
}
export function getPreparacionLegado(
  params: { dias?: number; limite?: number } = {},
  centroId?: string,
): Promise<PreparacionLegado> {
  const sp = new URLSearchParams();
  if (params.dias) sp.set("days", String(params.dias));
  // `limite` se queda en español: el BE lee @Query('limite') y el middleware NO traduce `limit`→`limite`
  // (`limit` está en NUNCA_SE_TRADUCEN), así que mandar `limit` dejaría el tope en el default sin avisar.
  if (params.limite) sp.set("limite", String(params.limite));
  return apiFetch<PreparacionLegado>(`/patients/legacy-availability/preparation?${sp.toString()}`, {}, centroId);
}

// Serie del récord del paciente (número de expediente al abrir un folder nuevo). El BE resuelve
// `proximo` por cálculo automático si el centro no la ha fijado (`configurada:false` → mostrar como
// «hoy entregaría el N», no como valor guardado). Cambiar el arranque exige `motivo` y solo avanza.
// Handoff qa-2026-09-03-lo-que-cambia-para-el-fe (§5). Permiso: numeracion.arranque.
export interface SerieRecord {
  configurada: boolean; // NO en el mapa → el BE lo devuelve en español
  series: string;
  prefix: string | null;
  padding: number; // se dice igual (CAMPOS_IGUALES)
  nextNumber: number;
}
export function getSerieRecord(centroId?: string): Promise<SerieRecord> {
  return apiFetch<SerieRecord>(`/patients/record-series`, {}, centroId);
}
export function actualizarSerieRecord(
  // `arranque` NO está en el mapa → se envía tal cual (el middleware lo deja pasar hasta el DTO).
  payload: { prefix?: string | null; padding?: number; arranque?: number; reason?: string },
  centroId?: string,
): Promise<SerieRecord> {
  return apiFetch<SerieRecord>(`/patients/record-series`, {
    method: "PUT",
    body: JSON.stringify(payload),
  }, centroId);
}
