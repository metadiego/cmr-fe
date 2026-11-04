import type { components } from "./schema";
import { apiFetch, apiFetchPaged, apiFetchEnvelope } from "./client";
import type { Paginated } from "./types";
import { getCentrosDondePuedo } from "./centers";
import { readCenterIds, tenantOf } from "@/lib/clinic-read-scope";

// Types generated from the BE Swagger (run `npm run gen:api` after BE changes).
//
// `patient`/`doctorName` are hand-added: GET /appointments embeds them on every row (verified
// live against prod, 09-oct-2026 — 100/100 rows carried patient.name), but the BE's Swagger
// doesn't document /appointments' response shape yet, so gen:api never picks them up. Drop this
// intersection once the Swagger gap closes and CitaEntity declares them itself. `clinicName` likewise:
// the BE puts it on every row it reads (clinic-read-scope).
export type Cita = components["schemas"]["CitaEntity"] & {
  patient?: { id: string; name: string; medicalRecordNumber?: string | null } | null;
  doctorName?: string | null;
  clinicName?: string | null;
};
export type CreateCitaPayload = components["schemas"]["CreateCitaDto"];
export type TipoCita = components["schemas"]["TipoCitaEntity"];
export type EstadoCita = Cita["status"];
export type CanalCita = Cita["channel"];

// State catalog (GET /appointments/statuses): labelKey/color/sortOrder/flags. Drive UI
// from this instead of hardcoding the state list. Fetched once (memoized promise).
export type EstadoCitaCatalogo = components["schemas"]["EstadoCitaEntity"];

let estadosPromise: Promise<EstadoCitaCatalogo[]> | null = null;
export function getEstados(): Promise<EstadoCitaCatalogo[]> {
  if (!estadosPromise) {
    estadosPromise = apiFetch<EstadoCitaCatalogo[]>(`/appointments/statuses`).catch((err) => {
      estadosPromise = null; // let it retry after a failure
      throw err;
    });
  }
  return estadosPromise;
}

// Overlap conflict + warning shapes (POST /appointments/validate and meta.advertencias).
// `advertencias`/`conflictos`/`ok` NO están en el mapa api-ingles → el BE los sirve tal cual (español).
export interface CitaConflicto {
  appointmentId: string;
  patientId: string;
  time: string;
  endTime: string;
}
export interface ValidarCitaResult {
  ok: boolean;
  advertencias: Array<{ code: string; labelKey?: string }>;
  conflictos: CitaConflicto[];
}

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
  date?: string; // YYYY-MM-DD (single day)
  from?: string;
  to?: string;
  doctorId?: string;
  patientId?: string;
  status?: EstadoCita;
  channel?: CanalCita;
  onlyCare?: boolean; // only states visible to the Atención board
  centerIds?: string[]; // the centers to read; each needs citas.read THERE
}

// Query string of a read: the filters plus `centerIds` (lib/clinic-read-scope.ts). The screen's picked
// center (`centroId`) goes as `centerIds`, not as X-Tenant-ID, so the read stays on it whatever the BE's
// default is. Handoff docs/specs/clinic-read-scope-handoff-fe.md.
function readQuery(filters: object, centroId?: string, centerIds?: string[]): URLSearchParams {
  const sp = new URLSearchParams();
  for (const [k, v] of Object.entries(filters)) {
    if (v) sp.set(k, String(v));
  }
  const ids = readCenterIds(centroId, centerIds);
  if (ids) sp.set("centerIds", ids.join(","));
  return sp;
}

// `centroId` (optional): the center picked on the screen, without moving the session's.
export function listCitas(
  params: ListCitasParams = {},
  centroId?: string,
): Promise<Paginated<Cita>> {
  const { page = 1, limit = 100, centerIds, ...filters } = params;
  const sp = readQuery({ page, limit, ...filters }, centroId, centerIds);
  // X-Tenant-ID = a clinic of the read, so the guard checks one where the permission is held.
  return apiFetchPaged<Cita>(`/appointments?${sp.toString()}`, {}, tenantOf(readCenterIds(centroId, centerIds)));
}

// Centers where the person can read appointments. Empty = not known (the read falls back to the
// BE's default).
export async function citasReadableCenterIds(): Promise<string[]> {
  const centros = await getCentrosDondePuedo("citas.read").catch(() => []);
  return centros.map((c) => c.id);
}

// A patient's or a doctor's appointments in every center the person can read, each row with its
// clinic. Once the BE reads every center by default this is plain `listCitas(params)`.
export async function listCitasEveryCenter(params: Omit<ListCitasParams, "centerIds"> = {}): Promise<Paginated<Cita>> {
  const centerIds = await citasReadableCenterIds();
  return listCitas({ ...params, centerIds });
}

// Fetch ALL citas for a range across pages (BE caps limit at 100). Used by the
// month calendar, where a busy month can exceed one page.
export async function listCitasRango(params: {
  from: string;
  to: string;
  doctorId?: string;
  status?: EstadoCita;
  centroId?: string; // the center picked on the screen
  centerIds?: string[];
}): Promise<Cita[]> {
  const { centroId, ...filters } = params;
  const acc: Cita[] = [];
  let page = 1;
  for (;;) {
    const { items, pagination } = await listCitas({ ...filters, page, limit: 100 }, centroId);
    acc.push(...items);
    if (items.length === 0 || acc.length >= pagination.total) break;
    page++;
    if (page > 50) break; // safety
  }
  return acc;
}

// Una fila por (fecha × tipo de cita) con el total — nombre/color del tipo salen del catálogo
// (`getTiposCita`), no de aquí. El Swagger del BE no documenta la forma de la respuesta todavía
// (`Record<string, never>[]`), de ahí el tipo a mano; campos confirmados con BE (PR #440, 16-oct-2026).
export interface ConteoPorDia {
  date: string;
  appointmentTypeId: string | null;
  total: number;
}

// Month calendar (BE PR #440): un número por (día × tipo) en vez de traer CADA cita para contarla a
// mano — reemplaza `listCitasRango` en la vista mes. Mismos filtros que la lista.
export function countByDay(params: {
  from: string;
  to: string;
  doctorId?: string;
  status?: EstadoCita;
  channel?: CanalCita;
  centroId?: string;
  centerIds?: string[];
}): Promise<ConteoPorDia[]> {
  const { centroId, centerIds, ...filters } = params;
  const sp = readQuery(filters, centroId, centerIds);
  return apiFetch<ConteoPorDia[]>(`/appointments/count-by-day?${sp.toString()}`, {}, tenantOf(readCenterIds(centroId, centerIds)));
}

// Found by id in every center the person can read; the row carries `clinicId`/`clinicName`.
export function getCita(id: string): Promise<Cita> {
  return apiFetch<Cita>(`/appointments/${id}`);
}

// Asignar la enfermera de VITALES de una cita (es el writeBinding `cita.enfermeraId` del modal de
// Notificar en Atención → campo real `vitalsNurseId`). `null` la limpia. PUT /appointments/:id.
// Verificado en prod: la fila del tablero refleja el nombre en `fd_enfermera` tras guardar.
export function asignarEnfermeraVitales(
  citaId: string,
  vitalsNurseId: string | null,
  centroId?: string,
): Promise<unknown> {
  return apiFetch(
    `/appointments/${citaId}`,
    { method: "PUT", body: JSON.stringify({ vitalsNurseId }) },
    centroId,
  );
}

// Writes are tenant-scoped: pass centroId to set X-Tenant-ID for this request.
export function createCita(
  payload: CreateCitaPayload,
  centroId?: string,
): Promise<Cita> {
  return apiFetch<Cita>(`/appointments`, {
    method: "POST",
    body: JSON.stringify(payload),
    headers: centroId ? { "X-Tenant-ID": centroId } : undefined,
  });
}

// Dry-run overlap check before saving (POST /appointments/validate). Does NOT create.
export function validarCita(
  payload: {
    doctorId?: string;
    date: string;
    time: string;
    endTime: string;
    appointmentTypeId?: string;
    excluirCitaId?: string; // NO está en el mapa api-ingles: se manda tal cual
  },
  centroId?: string,
): Promise<ValidarCitaResult> {
  return apiFetch<ValidarCitaResult>(`/appointments/validate`, {
    method: "POST",
    body: JSON.stringify(payload),
    headers: centroId ? { "X-Tenant-ID": centroId } : undefined,
  });
}

// Create returning the cita PLUS any non-fatal warnings the BE attached
// (meta.advertencias — e.g. an overlap created under the "advertir" policy).
export async function crearCitaAgenda(
  payload: CreateCitaPayload,
  centroId?: string,
): Promise<{ cita: Cita; advertencias: NonNullable<import("./types").ApiMeta["advertencias"]> }> {
  const env = await apiFetchEnvelope<Cita>(`/appointments`, {
    method: "POST",
    body: JSON.stringify(payload),
    headers: centroId ? { "X-Tenant-ID": centroId } : undefined,
  });
  return { cita: env.data, advertencias: env.meta?.advertencias ?? [] };
}

// Update returning cita + warnings (same envelope contract as create).
export async function actualizarCitaAgenda(
  id: string,
  payload: Partial<CreateCitaPayload>,
  centroId?: string,
): Promise<{ cita: Cita; advertencias: NonNullable<import("./types").ApiMeta["advertencias"]> }> {
  const env = await apiFetchEnvelope<Cita>(`/appointments/${id}`, {
    method: "PUT",
    body: JSON.stringify(payload),
    headers: centroId ? { "X-Tenant-ID": centroId } : undefined,
  });
  return { cita: env.data, advertencias: env.meta?.advertencias ?? [] };
}

// ---- Lifecycle transitions (slice 2: scheduling flow) ----------------------
// State machine (verified): programada →confirm→ confirmada →present→ presente
// →consultation→ en_consulta. triage/attend need vitals (slice 3). no-show/cancel/
// reschedule available from the open states. All are tenant-scoped writes.

function transition<T = Cita>(
  id: string,
  action: string,
  body: Record<string, unknown> | undefined,
  centroId?: string,
): Promise<T> {
  return apiFetch<T>(`/appointments/${id}/${action}`, {
    method: "POST",
    body: body ? JSON.stringify(body) : undefined,
    headers: centroId ? { "X-Tenant-ID": centroId } : undefined,
  });
}

export const confirmarCita = (id: string, centroId?: string) =>
  transition(id, "confirm", undefined, centroId);
export const presenteCita = (id: string, centroId?: string) =>
  transition(id, "present", undefined, centroId);
export const noShowCita = (id: string, centroId?: string) =>
  transition(id, "no-show", undefined, centroId);
export const cancelarCita = (id: string, motivo: string, centroId?: string) =>
  transition(id, "cancel", { reason: motivo }, centroId);
// Reschedule / move. `centerId` in the BODY = destination center (omit = keep).
// Cross-center MEDICA SEGUIMIENTO: send the destination `doctorId`. `actorId` =
// the operator's personal.id (audit trail). `tenant` scopes the request (source
// center). The BE records a `reprogramada` event with antes/después.
export function reagendarCita(
  id: string,
  payload: {
    date: string;
    time?: string;
    reason: string;
    centerId?: string; // destination center (omit → keep current)
    doctorId?: string;
    actorId?: string;
    appointmentTypeId?: string; // type of the NEW appointment (omit → the original's)
  },
  tenant?: string,
): Promise<Cita> {
  return apiFetch<Cita>(
    `/appointments/${id}/reschedule`,
    { method: "POST", body: JSON.stringify(payload) },
    tenant,
  );
}

// Appointment audit trail (GET /appointments/:id/history). The reschedule event
// carries payload.antes / payload.despues (fecha, hora, centroId, medicoId).
// `actorNombre` NO está en el mapa api-ingles → el BE lo sirve tal cual (español).
// `payload` es una bolsa OPACA: sus claves internas NO se traducen.
export interface CitaEvento {
  id: string;
  appointmentId: string;
  type: string; // "reprogramada" | "campo_editado" | "creada" | ...
  actorId: string | null;
  actorNombre?: string | null; // resolved by BE (actorId → personal); no está en el mapa
  reason: string | null;
  payload: {
    antes?: Record<string, unknown>;
    despues?: Record<string, unknown>;
    columna?: string; // campo_editado (antes/despues son valores simples)
  } | null;
  isRetroactive: boolean;
  createdAt: string;
}

export function getHistorial(id: string, centroId?: string): Promise<CitaEvento[]> {
  return apiFetch<CitaEvento[]>(`/appointments/${id}/history`, {}, centroId);
}

// Recent visits for a patient (most recent first), tenant-scoped. Used by the
// "Nueva cita" modal to show clinical context. Returns the unwrapped array.
export function getVisitasRecientes(
  pacienteId: string,
  centroId?: string,
): Promise<Cita[]> {
  return apiFetch<Cita[]>(`/appointments?patientId=${pacienteId}&limit=6`, {}, centroId);
}

// Appointment type catalog (medica / seguimiento / control, each requiresDoctor).
export async function getTiposCita(): Promise<TipoCita[]> {
  const res = (await apiFetch(`/appointments/types`)) as unknown;
  if (Array.isArray(res)) return res as TipoCita[];
  const items = (res as { items?: unknown } | null)?.items;
  return Array.isArray(items) ? (items as TipoCita[]) : [];
}

// Cupos libres de UN tipo de cita en UN día (BE 2-oct, available-slots). Devuelve las franjas con huecos
// libres/capacidad y la duración del tipo (para derivar la hora de fin). NO bloqueante: las llenas llegan
// con free:0 y cappedBy:"cupo". Reusa CuposService (precedencia fecha>diaSemana>default, centro>global).
// Handoff citas-hora-por-cupo-handoff-be.
export interface SlotLibre {
  time: string;
  capacity: number;
  free: number;
  cappedBy: string | null;
}
export interface CuposLibres {
  date: string;
  appointmentTypeId: string;
  durationMinutes: number | null;
  // El BE oscila el nombre del array entre `slots` y `franjas` (el glosario global de /api/v2 lo movió otra
  // vez el 2-oct). Ambos opcionales; el FE lee el que venga (`slots ?? franjas`) para no romperse en el vaivén.
  slots?: SlotLibre[];
  franjas?: SlotLibre[];
}
export function getCuposLibres(
  date: string,
  appointmentTypeId: string,
  centroId?: string,
): Promise<CuposLibres> {
  const sp = new URLSearchParams({ date, appointmentTypeId });
  return apiFetch<CuposLibres>(`/appointments/available-slots?${sp.toString()}`, {}, centroId);
}
