import { apiFetch } from "./client";

// Agenda de terapias por RECURSOS (cuarto/silla/persona), no por servicio. El cuello es el recurso:
// APEX ocupa un room de láser; las sillas de suero admiten varias terapias a la vez. Contrato:
// cmr-be/docs/specs/HANDOFF-FE-agenda-de-terapias.md. Nada quemado: todo por API.

// `simultaneous` = varias terapias a la vez (silla de suero, ocupa lo que dure la más larga).
// `sequential` = del mismo paciente se SUMAN, una tras otra (room de NPT).
export type ResourceConcurrency = "simultaneous" | "sequential";
export type ResourceKind = "room" | "chair" | "person" | string;

export interface Resource {
  id: string;
  slug: string;
  name: string;
  labelKey?: string | null; // se dice igual (CAMPOS_IGUALES)
  capacity: number; // cuántos pacientes a la vez
  kind: ResourceKind;
  concurrency: ResourceConcurrency;
  maxMinutesPerPatient: number | null; // tope por paciente (90 en las sillas)
  staffRole: string | null; // cargo que lo atiende; el techo real = menor entre puestos y gente de turno
  staffId: string | null; // cuando el recurso ES una persona (la doctora de EMPOWER)
  blocksStaffAgenda: boolean; // si ocupa la agenda de consultas de esa persona
  active: boolean;
}

// Payload de alta/edición (id/active los maneja el server; DELETE desactiva).
export type ResourcePayload = Omit<Resource, "id" | "active"> & { active?: boolean };

function asArray<T>(res: unknown): T[] {
  if (Array.isArray(res)) return res as T[];
  const items = (res as { items?: unknown } | null)?.items;
  return Array.isArray(items) ? (items as T[]) : [];
}

// --- CRUD de recursos (permiso resources.read / resources.config) ---
export async function listResources(centroId?: string): Promise<Resource[]> {
  return asArray<Resource>(await apiFetch(`/resources`, {}, centroId));
}
export function createResource(payload: ResourcePayload, centroId?: string): Promise<Resource> {
  return apiFetch<Resource>(`/resources`, { method: "POST", body: JSON.stringify(payload) }, centroId);
}
export function updateResource(id: string, payload: Partial<ResourcePayload>, centroId?: string): Promise<Resource> {
  return apiFetch<Resource>(`/resources/${id}`, { method: "PUT", body: JSON.stringify(payload) }, centroId);
}
// OJO: DESACTIVA, no borra (regla del dueño). La UI dice «Desactivar», nunca «Eliminar».
export function deactivateResource(id: string, centroId?: string): Promise<void> {
  return apiFetch<void>(`/resources/${id}`, { method: "DELETE" }, centroId);
}

// --- Lo que consume un servicio (GET/PUT reemplaza la lista entera) ---
// `per`: "session" (fijo) o "area" (multiplica por las áreas del paciente).
// `blocking: false` = ocupa su puesto pero NO al paciente (el Transcraneal es un casco durante el suero).
export interface ServiceResourceLine {
  resourceId: string;
  minutes: number;
  per: "session" | "area";
  blocking: boolean;
}
export async function getServiceResources(serviceId: string, centroId?: string): Promise<ServiceResourceLine[]> {
  const r = await apiFetch<{ resources?: ServiceResourceLine[] } | ServiceResourceLine[]>(
    `/resources/services/${serviceId}`,
    {},
    centroId,
  );
  return Array.isArray(r) ? r : (r?.resources ?? []);
}
export function setServiceResources(serviceId: string, resources: ServiceResourceLine[], centroId?: string): Promise<unknown> {
  return apiFetch(`/resources/services/${serviceId}`, { method: "PUT", body: JSON.stringify({ resources }) }, centroId);
}

// --- Huecos de un servicio en un día (para la pantalla de programar) ---
// `reasonKey` es clave i18n: therapies.full | therapies.noStaff | therapies.overMaxPerPatient.
export interface AvailabilitySlot {
  time: string; // "HH:mm" — las genera el BE (7:00–17:00 cada 30m); NO inventarlas en el FE
  fits: boolean;
  freeStations?: number;
  reasonKey?: string | null;
}
export interface Availability {
  configured: boolean; // false = el servicio no tiene recurso declarado → se cita como hoy, sin huecos
  minutes: number; // ya calculado con las áreas
  resource?: { slug: string; capacity: number; concurrency: ResourceConcurrency } | null;
  slots: AvailabilitySlot[];
}
export function getAvailability(
  params: { date: string; serviceId: string; areas?: number },
  centroId?: string,
  centerIds?: string[],
): Promise<Availability> {
  const sp = new URLSearchParams({ date: params.date, serviceId: params.serviceId });
  if (params.areas != null) sp.set("areas", String(params.areas));
  for (const c of centerIds ?? []) sp.append("centerIds", c);
  return apiFetch<Availability>(`/resources/availability?${sp.toString()}`, {}, centroId);
}

// --- El día completo del paciente (calcula y valida; NO agenda; agendar sigue por frontdesk) ---
export interface PatientDayStaffBlock {
  staffId: string;
  date: string;
  from: string;
  to: string;
  resourceSlug: string;
}
export interface PatientDayResult {
  ok: boolean;
  reasonKey?: string | null; // cuando el día no cabe
  porRecurso: { resourceId: string; minutes: number; servicios: string[] }[];
  minutosDelPaciente: number; // tiempo REAL en la clínica (no la suma de recursos; el casco no suma)
  sinRecurso: string[]; // servicios pedidos que nadie configuró
  staffBlocks: PatientDayStaffBlock[]; // agendar EMPOWER bloquea la agenda de la doctora
}
export function planPatientDay(
  body: { serviceIds: string[]; date: string; time: string },
  centroId?: string,
): Promise<PatientDayResult> {
  return apiFetch<PatientDayResult>(`/resources/patient-day`, { method: "POST", body: JSON.stringify(body) }, centroId);
}
