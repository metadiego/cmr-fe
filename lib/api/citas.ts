import type { components } from "./schema";
import { apiFetch, apiFetchPaged, apiFetchEnvelope } from "./client";
import type { Paginated } from "./types";

// Types generated from the BE Swagger (run `npm run gen:api` after BE changes).
export type Cita = components["schemas"]["CitaEntity"];
export type CreateCitaPayload = components["schemas"]["CreateCitaDto"];
export type TipoCita = components["schemas"]["TipoCitaEntity"];
export type EstadoCita = Cita["estado"];
export type CanalCita = Cita["canal"];

// State catalog (GET /citas/estados): labelKey/color/orden/flags. Drive UI from
// this instead of hardcoding the state list. Fetched once (memoized promise).
export type EstadoCitaCatalogo = components["schemas"]["EstadoCitaEntity"];

let estadosPromise: Promise<EstadoCitaCatalogo[]> | null = null;
export function getEstados(): Promise<EstadoCitaCatalogo[]> {
  if (!estadosPromise) {
    estadosPromise = apiFetch<EstadoCitaCatalogo[]>(`/citas/estados`).catch((err) => {
      estadosPromise = null; // let it retry after a failure
      throw err;
    });
  }
  return estadosPromise;
}

// Overlap conflict + warning shapes (POST /citas/validar and meta.advertencias).
export interface CitaConflicto {
  citaId: string;
  pacienteId: string;
  hora: string;
  horaFin: string;
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
  fecha?: string; // YYYY-MM-DD (single day)
  desde?: string;
  hasta?: string;
  medicoId?: string;
  pacienteId?: string;
  estado?: EstadoCita;
  canal?: CanalCita;
  soloAtencion?: boolean; // only states visible to the Atención board
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

// Fetch ALL citas for a range across pages (BE caps limit at 100). Used by the
// month calendar, where a busy month can exceed one page.
export async function listCitasRango(params: {
  desde: string;
  hasta: string;
  medicoId?: string;
  estado?: EstadoCita;
}): Promise<Cita[]> {
  const acc: Cita[] = [];
  let page = 1;
  for (;;) {
    const { items, pagination } = await listCitas({ ...params, page, limit: 100 });
    acc.push(...items);
    if (items.length === 0 || acc.length >= pagination.total) break;
    page++;
    if (page > 50) break; // safety
  }
  return acc;
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

// Dry-run overlap check before saving (POST /citas/validar). Does NOT create.
export function validarCita(
  payload: {
    medicoId?: string;
    fecha: string;
    hora: string;
    horaFin: string;
    tipoCitaId?: string;
    excluirCitaId?: string;
  },
  centroId?: string,
): Promise<ValidarCitaResult> {
  return apiFetch<ValidarCitaResult>(`/citas/validar`, {
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
  const env = await apiFetchEnvelope<Cita>(`/citas`, {
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
  const env = await apiFetchEnvelope<Cita>(`/citas/${id}`, {
    method: "PUT",
    body: JSON.stringify(payload),
    headers: centroId ? { "X-Tenant-ID": centroId } : undefined,
  });
  return { cita: env.data, advertencias: env.meta?.advertencias ?? [] };
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
// Reschedule / move. `centroId` in the BODY = destination center (omit = keep).
// Cross-center MEDICA SEGUIMIENTO: send the destination `medicoId`. `actorId` =
// the operator's personal.id (audit trail). `tenant` scopes the request (source
// center). The BE records a `reprogramada` event with antes/después.
export function reagendarCita(
  id: string,
  payload: {
    fecha: string;
    hora?: string;
    motivo: string;
    centroId?: string; // destination center (omit → keep current)
    medicoId?: string;
    actorId?: string;
  },
  tenant?: string,
): Promise<Cita> {
  return apiFetch<Cita>(
    `/citas/${id}/reagendar`,
    { method: "POST", body: JSON.stringify(payload) },
    tenant,
  );
}

// Appointment audit trail (GET /citas/:id/historial). The reschedule event
// carries payload.antes / payload.despues (fecha, hora, centroId, medicoId).
export interface CitaEvento {
  id: string;
  citaId: string;
  tipo: string; // "reprogramada" | "campo_editado" | "creada" | ...
  actorId: string | null;
  actorNombre?: string | null; // resolved by BE (actorId → personal)
  motivo: string | null;
  payload: {
    antes?: Record<string, unknown>;
    despues?: Record<string, unknown>;
    columna?: string; // campo_editado (antes/despues son valores simples)
  } | null;
  esRetroactivo: boolean;
  createdAt: string;
}

export function getHistorial(id: string, centroId?: string): Promise<CitaEvento[]> {
  return apiFetch<CitaEvento[]>(`/citas/${id}/historial`, {}, centroId);
}

// Recent visits for a patient (most recent first), tenant-scoped. Used by the
// "Nueva cita" modal to show clinical context. Returns the unwrapped array.
export function getVisitasRecientes(
  pacienteId: string,
  centroId?: string,
): Promise<Cita[]> {
  return apiFetch<Cita[]>(`/citas?pacienteId=${pacienteId}&limit=6`, {}, centroId);
}

// Appointment type catalog (medica / seguimiento / control, each requiereMedico).
export async function getTiposCita(): Promise<TipoCita[]> {
  const res = (await apiFetch(`/citas/tipos`)) as unknown;
  if (Array.isArray(res)) return res as TipoCita[];
  const items = (res as { items?: unknown } | null)?.items;
  return Array.isArray(items) ? (items as TipoCita[]) : [];
}
