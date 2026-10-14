import type { components } from "./schema"
import { apiFetch, apiFetchPaged } from "./client"
import type { Paginated } from "./types"

// Types generated from the BE Swagger (run `npm run gen:api` after BE changes).
export type Paciente = components["schemas"]["PacienteEntity"] & {
  displayName?: string | null
}
export type CreatePacientePayload = components["schemas"]["CreatePacienteDto"]
export type UpdatePacientePayload = components["schemas"]["UpdatePacienteDto"]

export interface ListPacientesParams {
  page?: number
  limit?: number
  q?: string
  doctorId?: string // pacientes de UN médico (GET /patients?doctorId=) — para el hub del médico
}

// GET /pacientes — paginated; `q` searches name/docId/etc. Tenant scope:
// `tenant` undefined → active center; a centroId string → force that center;
// null → OMIT X-Tenant-ID so the BE returns patients across ALL the user's
// centers (master "todos los centros" view — distinguish rows by clinicId).
export function listPacientes(
  params: ListPacientesParams = {},
  tenant?: string | null
): Promise<Paginated<Paciente>> {
  const { page = 1, limit = 20, q, doctorId } = params
  const sp = new URLSearchParams({ page: String(page), limit: String(limit) })
  if (q?.trim()) sp.set("q", q.trim())
  if (doctorId) sp.set("doctorId", doctorId)
  return apiFetchPaged<Paciente>(`/patients?${sp.toString()}`, {}, tenant)
}

export function getPaciente(id: string, centroId?: string): Promise<Paciente> {
  return apiFetch<Paciente>(`/patients/${id}`, {}, centroId)
}

// Writes are tenant-scoped: the BE needs the target center. Pass `centroId` to
// override the active-center header for this request (required for master /
// multi-center users who have no auto-locked center).
export function createPaciente(
  payload: CreatePacientePayload,
  centroId?: string
): Promise<Paciente> {
  return apiFetch<Paciente>(`/patients`, {
    method: "POST",
    body: JSON.stringify(payload),
    headers: centroId ? { "X-Tenant-ID": centroId } : undefined,
  })
}

export function updatePaciente(
  id: string,
  payload: UpdatePacientePayload,
  centroId?: string
): Promise<Paciente> {
  return apiFetch<Paciente>(`/patients/${id}`, {
    method: "PUT",
    body: JSON.stringify(payload),
    headers: centroId ? { "X-Tenant-ID": centroId } : undefined,
  })
}

// Assign the next consecutive record number (`record`) for the patient's
// center (POST /pacientes/:id/asignar-record). Used when a patient has no record
// yet. Tenant-scoped: pass centroId so the BE picks the right center's sequence.
export function asignarRecord(
  id: string,
  centroId?: string
): Promise<Paciente> {
  return apiFetch<Paciente>(`/patients/${id}/assign-record`, {
    method: "POST",
    headers: centroId ? { "X-Tenant-ID": centroId } : undefined,
  })
}

// Soft-delete: the BE sets activo=false (clinical history is kept) and the
// patient drops out of the list. Reactivate with updatePaciente(id,{activo:true}).
export function deletePaciente(id: string, centroId?: string): Promise<void> {
  return apiFetch<void>(`/patients/${id}`, {
    method: "DELETE",
    headers: centroId ? { "X-Tenant-ID": centroId } : undefined,
  })
}

// ─── Alta validada (docs/specs/paciente-alta-validada.md del BE) ─────────────
// Tipos locales hasta regenerar schema.d.ts con `npm run gen:api` (el BE debe
// estar desplegado/corriendo con los endpoints nuevos).

// Quién posee un número de récord en el centro. `dueno` null = disponible.
export interface RecordDueno {
  medicalRecordNumber: string
  disponible: boolean // NO en el mapa de campos → el BE lo devuelve en español
  dueno: {
    // `dueno` NO está en el mapa → la clave del contenedor queda en español
    id: string
    firstName: string
    lastName: string | null
    medicalRecordNumber: string | null
    active: boolean
  } | null
}

// GET /pacientes/record/:record — pre-chequeo de duplicidad del récord manual,
// SIEMPRE acotado al centro (el mismo número en otro centro es otra persona).
export function getRecordDueno(
  record: string,
  centroId?: string
): Promise<RecordDueno> {
  return apiFetch<RecordDueno>(
    `/patients/record/${encodeURIComponent(record)}`,
    {},
    centroId
  )
}

// Config efectiva del alta del centro: qué campos son obligatorios además de
// nombres (default del BE: telefono, zipcode, sexo; cada centro puede sobreescribir).
export function getConfigAltaPacientes(
  centroId?: string
): Promise<{ requiredFields: string[] }> {
  return apiFetch<{ requiredFields: string[] }>(
    `/patients/discharge-config`,
    {},
    centroId
  )
}

// PUT /pacientes/config-alta — define qué exige el alta. alcance: "centro" (por defecto, solo el
// centro activo) o "todos" (exige admin; aplica a todos los centros). Devuelve a qué centros aplicó.
// RBAC pacientes.config. "Datos obligatorios del paciente" ≠ "campos requeridos por servicio".
export type AltaConfigResult = {
  requiredFields: string[]
  scope: "centro" | "todos" // valores de dato, no claves → se quedan igual
  centers: string[]
}
export function updateConfigAltaPacientes(
  payload: { requiredFields: string[]; scope?: "centro" | "todos" },
  centroId?: string
): Promise<AltaConfigResult> {
  return apiFetch<AltaConfigResult>(
    `/patients/discharge-config`,
    { method: "PUT", body: JSON.stringify(payload) },
    centroId
  )
}

// --- Disponibilidad heredada del LEGADO (BE 18-ago) ---------------------------------------------
// El número de récord NO identifica a una persona: en prod hay 239 récords compartidos por >1 ficha.
// Flujo: diagnosticar por récord → si es ambiguo (409 RECORD_AMBIGUO con `candidatos`), elegir a quién
// → repetir con pacienteId → aplicar con ese mismo pacienteId. Handoff HANDOFF-record-ambiguo-elegir-persona.
// El endpoint NO está aún en el schema generado (gen:api pendiente) → se tipa aquí.
export interface CandidatoRecord {
  id: string
  medicalRecordNumber: string
  firstName?: string | null
  lastName?: string | null
  phone?: string | null
  dateOfBirth?: string | null
  createdAt?: string | null
}
// La forma del diagnóstico "feliz" la sirve el BE al leer el legado; se tipa laxa (hoy la nube
// devuelve 500 porque el contenedor no trae sqlcmd — solo el camino del 409 es probable en prod).
export interface DiagnosticoLegado {
  medicalRecordNumber: string
  patientId?: string | null
  patient?: {
    id?: string
    firstName?: string | null
    lastName?: string | null
  } | null
  items?: unknown[]
  [k: string]: unknown
}
export function diagnosticoDisponibilidadLegado(
  record: string,
  pacienteId?: string,
  centroId?: string
): Promise<DiagnosticoLegado> {
  const qs = pacienteId ? `?patientId=${encodeURIComponent(pacienteId)}` : ""
  return apiFetch<DiagnosticoLegado>(
    `/patients/legacy-availability/${encodeURIComponent(record)}/diagnosis${qs}`,
    {},
    centroId
  )
}
export function aplicarDisponibilidadLegado(
  record: string,
  payload: { pacienteId: string; items: unknown[] },
  centroId?: string
): Promise<unknown> {
  return apiFetch<unknown>(
    `/patients/legacy-availability/${encodeURIComponent(record)}/apply`,
    { method: "POST", body: JSON.stringify(payload) },
    centroId
  )
}

// Reporte de PREPARACIÓN del legado: a quién con cita próxima le falta cargar disponibilidad heredada.
// `estado` colorea la fila (pendiente|al_dia|sin_record|record_ambiguo|error). `omitidos`>0 = hubo más que
// el tope (decirlo, no esconderlo). Permiso factura.retroactivo. Handoff rol-multicentro-y-preparacion-legado.
export interface PreparacionFila {
  pacienteId: string
  record?: string | null
  nombre?: string | null
  proximaCita?: string | null
  estado:
    | "pendiente"
    | "al_dia"
    | "sin_record"
    | "record_ambiguo"
    | "error"
    | string
  items?: unknown[]
  candidatos?: CandidatoRecord[]
  motivo?: string | null
}
// OJO: `filas` es una bolsa OPACA (el interceptor traduce la clave del contenedor a `rows` pero NO
// recorre su contenido) → las filas (PreparacionFila) conservan sus claves en español.
export interface PreparacionLegado {
  from: string
  to: string
  total: number
  skipped: number
  rows: PreparacionFila[]
}
export function getPreparacionLegado(
  params: { dias?: number; limite?: number } = {},
  centroId?: string
): Promise<PreparacionLegado> {
  const sp = new URLSearchParams()
  if (params.dias) sp.set("days", String(params.dias))
  // `limite` se queda en español: el BE lee @Query('limite') y el middleware NO traduce `limit`→`limite`
  // (`limit` está en NUNCA_SE_TRADUCEN), así que mandar `limit` dejaría el tope en el default sin avisar.
  if (params.limite) sp.set("limite", String(params.limite))
  return apiFetch<PreparacionLegado>(
    `/patients/legacy-availability/preparation?${sp.toString()}`,
    {},
    centroId
  )
}

// Serie del récord del paciente (número de expediente al abrir un folder nuevo). El BE resuelve
// `proximo` por cálculo automático si el centro no la ha fijado (`configurada:false` → mostrar como
// «hoy entregaría el N», no como valor guardado). Cambiar el arranque exige `motivo` y solo avanza.
// Handoff qa-2026-09-03-lo-que-cambia-para-el-fe (§5). Permiso: numeracion.arranque.
export interface SerieRecord {
  configurada: boolean // NO en el mapa → el BE lo devuelve en español
  series: string
  prefix: string | null
  padding: number // se dice igual (CAMPOS_IGUALES)
  nextNumber: number
}
export function getSerieRecord(centroId?: string): Promise<SerieRecord> {
  return apiFetch<SerieRecord>(`/patients/record-series`, {}, centroId)
}
export function actualizarSerieRecord(
  // `arranque` NO está en el mapa → se envía tal cual (el middleware lo deja pasar hasta el DTO).
  payload: {
    prefix?: string | null
    padding?: number
    arranque?: number
    reason?: string
  },
  centroId?: string
): Promise<SerieRecord> {
  return apiFetch<SerieRecord>(
    `/patients/record-series`,
    {
      method: "PUT",
      body: JSON.stringify(payload),
    },
    centroId
  )
}

// ─── Banderas de prioridad (docs/specs/alertas-de-prioridad-del-paciente.md del BE) ──────────────
// Tipos locales hasta `gen:api` (endpoints nuevos, 06-oct-2026). Catálogo GLOBAL (no por centro);
// las banderas en sí son por paciente (tenant-scoped). `icon`/`color` son claves libres que define
// el FE (ver lib/patients/priority-flags.ts) — el BE solo las guarda y las devuelve tal cual.
export interface PriorityFlagType {
  id: string
  slug: string
  labelKey: string
  icon: string | null
  color: string | null
  active: boolean
}
export type CreatePriorityFlagTypePayload = {
  slug: string
  labelKey: string
  icon?: string
  color?: string
}
export type UpdatePriorityFlagTypePayload = Partial<
  Pick<PriorityFlagType, "labelKey" | "icon" | "color" | "active">
>

export function getPriorityFlagTypes(): Promise<PriorityFlagType[]> {
  return apiFetch<PriorityFlagType[]>(`/patients/priority-flag-types`)
}
export function createPriorityFlagType(
  payload: CreatePriorityFlagTypePayload
): Promise<PriorityFlagType> {
  return apiFetch<PriorityFlagType>(`/patients/priority-flag-types`, {
    method: "POST",
    body: JSON.stringify(payload),
  })
}
export function updatePriorityFlagType(
  id: string,
  payload: UpdatePriorityFlagTypePayload
): Promise<PriorityFlagType> {
  return apiFetch<PriorityFlagType>(`/patients/priority-flag-types/${id}`, {
    method: "PUT",
    body: JSON.stringify(payload),
  })
}

// Banderas YA resueltas contra el catálogo (listas para pintar: labelKey/icon/color propios).
export interface PatientPriorityFlag {
  slug: string
  labelKey: string
  icon: string | null
  color: string | null
  note?: string | null
}
export function getPatientPriorityFlags(
  patientId: string,
  centroId?: string
): Promise<PatientPriorityFlag[]> {
  return apiFetch<PatientPriorityFlag[]>(
    `/patients/${patientId}/priority-flags`,
    {},
    centroId
  )
}
// Flags of several patients in one read (max 200 ids per call, so longer lists are chunked). One entry
// per patient asked, `flags: []` when none. `centroId` also goes as `centerIds` to resolve the permission.
export const PRIORITY_FLAGS_MAX_IDS = 200
export async function getPatientsPriorityFlags(
  patientIds: string[],
  centroId?: string
): Promise<Array<{ patientId: string; flags: PatientPriorityFlag[] }>> {
  const chunks: string[][] = []
  for (let i = 0; i < patientIds.length; i += PRIORITY_FLAGS_MAX_IDS)
    chunks.push(patientIds.slice(i, i + PRIORITY_FLAGS_MAX_IDS))
  const pages = await Promise.all(
    chunks.map((ids) => {
      const q = new URLSearchParams({ patientIds: ids.join(",") })
      if (centroId) q.set("centerIds", centroId)
      return apiFetch<
        Array<{ patientId: string; flags: PatientPriorityFlag[] }>
      >(`/patients/priority-flags?${q}`, {}, centroId)
    })
  )
  return pages.flat()
}
// Idempotente (el BE no duplica si ya la tiene). `flagTypeId` es el id del CATÁLOGO, no el slug.
export function addPatientPriorityFlag(
  patientId: string,
  flagTypeId: string,
  note?: string,
  centroId?: string
): Promise<unknown> {
  return apiFetch(
    `/patients/${patientId}/priority-flags`,
    { method: "POST", body: JSON.stringify({ flagTypeId, note }) },
    centroId
  )
}
// 204; no falla si el paciente ya no tenía esa bandera.
export function removePatientPriorityFlag(
  patientId: string,
  flagTypeId: string,
  centroId?: string
): Promise<void> {
  return apiFetch<void>(
    `/patients/${patientId}/priority-flags/${flagTypeId}`,
    { method: "DELETE" },
    centroId
  )
}

// ─── Ubicación en vivo (docs/specs/ubicacion-en-vivo-del-paciente.md del BE) ─────────────────────
// Solo pacientes con actividad HOY sin terminar; ausencia = no sale en la lista (no hay fila "no
// está"). La precedencia cita×sesión (quién gana si tiene las dos abiertas) ya la resuelve el BE —
// el FE solo pinta la fila que llega. Handoff HANDOFF-ubicacion-en-vivo-del-paciente.md.
export interface PatientLiveLocation {
  patientId: string
  displayName: string
  location: "vitales" | "consulta" | "servicio"
  serviceSlug: string | null
  status: "presente" | "triage" | "en_consulta" | "en_terapia"
  from: string
  // Bonus del BE (verificado en vivo, no documentado en el handoff): mismo patrón de `patient`
  // adjunto que ya usan las sesiones de Servicios — trae el récord sin pedirlo aparte.
  patient?: {
    id: string
    medicalRecordNumber: string | null
    name: string | null
  } | null
}
export function getLiveLocation(
  centroId?: string
): Promise<PatientLiveLocation[]> {
  return apiFetch<PatientLiveLocation[]>(
    `/patients/live-location`,
    {},
    centroId
  )
}

// ─── Récord nuevo por inactividad (docs/specs/record-nuevo-por-inactividad.md del BE) ────────────
// "Inactivo" = su última cita ATENDIDA o sesión ASISTIDA (visita completa de verdad) tiene N+ años
// — NUNCA "nunca marcado Presente" (ver HANDOFF-paciente-nuevo-deberia-mirar-atendida). El cuadrito
// de editar el récord YA EXISTE (CeldaEditable en Atención); esto solo añade la sugerencia + el
// historial, y el endpoint especial que guarda el récord VIEJO al reemplazar.
export interface OldRecordSuggestion {
  suggested: boolean
  yearsInactive: number | null
  suggestedRecord: string | null
}
export function getOldRecordSuggestion(
  patientId: string,
  centroId?: string
): Promise<OldRecordSuggestion> {
  return apiFetch<OldRecordSuggestion>(
    `/patients/${patientId}/old-record-suggestion`,
    {},
    centroId
  )
}
// `newRecord` omitido = usa el sugerido por el BE. A diferencia de editar la celda Record a mano,
// ESTE endpoint SÍ guarda el récord viejo en el historial — usar el de editar celda aquí lo perdería.
export function replaceRecord(
  patientId: string,
  newRecord?: string,
  centroId?: string
): Promise<Paciente> {
  return apiFetch<Paciente>(
    `/patients/${patientId}/replace-record`,
    {
      method: "POST",
      body: JSON.stringify(newRecord ? { newRecord } : {}),
    },
    centroId
  )
}
export interface RecordHistoryEntry {
  oldRecord: string
  newRecord: string
  reason: string | null
  createdAt: string
}
export function getRecordHistory(
  patientId: string,
  centroId?: string
): Promise<RecordHistoryEntry[]> {
  return apiFetch<RecordHistoryEntry[]>(
    `/patients/${patientId}/record-history`,
    {},
    centroId
  )
}
// Búsqueda por el récord VIEJO (del expediente físico): a qué paciente/récord actual corresponde
// HOY. Para cuando recepción trae un expediente físico con un número que ya no es el vigente.
// Verificado en vivo SOLO el caso sin match (`data: []`); el shape de un match real no se probó
// (no había un récord viejo real a mano) — confirmar antes de construir la pantalla de búsqueda.
export function buscarPorRecordViejo(
  record: string,
  centroId?: string
): Promise<RecordHistoryEntry[]> {
  return apiFetch<RecordHistoryEntry[]>(
    `/patients/record-history/by-old-record/${encodeURIComponent(record)}`,
    {},
    centroId
  )
}
