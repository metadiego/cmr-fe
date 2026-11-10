import { apiFetch, apiFetchEnvelope } from "./client";
import type { ConWarnings, Sesion } from "./frontdesk";

// Agenda de terapias por RECURSOS (cuarto/silla/persona), no por servicio. El cuello es el recurso:
// APEX ocupa un room de láser; las sillas de suero admiten varias terapias a la vez. Contrato:
// cmr-be/docs/specs/HANDOFF-FE-agenda-de-terapias.md. Nada quemado: todo por API.

// `simultaneous` = varias terapias a la vez (silla de suero, ocupa lo que dure la más larga).
// `sequential` = del mismo paciente se SUMAN, una tras otra (room de NPT).
export type ResourceConcurrency = "simultaneous" | "sequential";
// `staff` = un pozo de gente de un cargo (la enfermería), no un sitio: su `capacity` no limita, el
// techo es cuánta gente de `staffRole` hay de turno (BE PR #518). `machine` ya existía en el BE.
export type ResourceKind = "room" | "chair" | "person" | "machine" | "staff" | string;

export interface Resource {
  id: string;
  slug: string;
  name: string;
  labelKey?: string | null; // se dice igual (CAMPOS_IGUALES)
  capacity: number; // cuántos pacientes a la vez
  kind: ResourceKind;
  concurrency: ResourceConcurrency;
  maxMinutesPerPatient: number | null; // tope por paciente (90 en las sillas)
  staffRole: string | null; // cargo EDITABLE del recurso; casi siempre vacío a propósito (ver `effectiveStaffRole`)
  // Cargo YA RESUELTO por el BE (PR #368): usar ESTE para pintar la columna "Staff", no `staffRole` a
  // secas. Un recurso compartido por varios cargos (p. ej. el room de NPT/GLP-1/NEUROCATCH) lo trae
  // `null` A PROPÓSITO — mezcla roles, y el BE no inventa uno. Verificado en vivo contra prod, 2026-09-27.
  effectiveStaffRole: string | null;
  staffId: string | null; // cuando el recurso ES una persona (la doctora de EMPOWER)
  blocksStaffAgenda: boolean; // si ocupa la agenda de consultas de esa persona
  // Peso en el tren de terapias (BE PR #517): a más alto, antes va. Los recursos escasos (rooms de
  // láser, sillas de suero, la doctora de EMPOWER) anclan el tren. Default 0.
  trainWeight: number;
  active: boolean;
  // Servicios que consumen este recurso, con SUS minutos reales (PR cmr-be #371) — sin esto había
  // que entrar a "Consumption per service" uno por uno para ver cuánto dura cada terapia aquí.
  // NUNCA un solo número: un recurso compartido tiene duraciones distintas por servicio
  // (laser_rooms: láser 10·área, APEX 60·sesión) y promediar sería inventar un dato falso.
  services: Array<{ serviceId: string; slug: string; name: string; minutes: number; per: string }>;
}

// Payload de alta/edición (id/active los maneja el server; DELETE desactiva). `effectiveStaffRole` y
// `services` son SOLO LECTURA (los calcula el BE) — nunca se mandan de vuelta.
export type ResourcePayload = Omit<Resource, "id" | "active" | "effectiveStaffRole" | "services"> & { active?: boolean };

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
  // El CARGO va en la TERAPIA, no en el recurso: el mismo room puede llevar técnico (NPT) o enfermera (GLP-1).
  // Vacío/null = hereda el `staffRole` del recurso. Handoff HANDOFF-FE-agenda-de-terapias.
  staffRole?: string | null;
  // Cuántos pacientes lleva a la vez esa persona: 1 = uno-a-uno (láser); 6 = las cámaras. Vacío/null = 1.
  patientsPerStaff?: number | null;
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
  // Con un servicio de varias líneas (BE PR #518), el recurso de la línea que bloquea.
  resourceId?: string | null;
}
export interface Availability {
  configured: boolean; // false = el servicio no tiene recurso declarado → se cita como hoy, sin huecos
  minutes: number; // ya calculado con las áreas
  resource?: { slug: string; capacity: number; concurrency: ResourceConcurrency } | null;
  slots: AvailabilitySlot[];
}
export function getAvailability(
  params: { date: string; serviceId: string; areas?: number; patientId?: string },
  centroId?: string,
  centerIds?: string[],
): Promise<Availability> {
  const sp = new URLSearchParams({ date: params.date, serviceId: params.serviceId });
  if (params.areas != null) sp.set("areas", String(params.areas));
  if (params.patientId) sp.set("patientId", params.patientId);
  for (const c of centerIds ?? []) sp.append("centerIds", c);
  return apiFetch<Availability>(`/resources/availability?${sp.toString()}`, {}, centroId);
}

// --- Preferencia del planificador de series (docs/specs/reversas-de-la-serie-solo-hacia-adelante) ---
export interface RecurringBookingConfig {
  preferForwardTime: boolean;
}
export function getRecurringBookingConfig(centroId?: string): Promise<RecurringBookingConfig> {
  return apiFetch<RecurringBookingConfig>(`/resources/recurring-booking-config`, {}, centroId);
}
export function setRecurringBookingConfig(
  preferForwardTime: boolean,
  centroId?: string,
): Promise<RecurringBookingConfig> {
  return apiFetch<RecurringBookingConfig>(
    `/resources/recurring-booking-config`,
    { method: "PUT", body: JSON.stringify({ preferForwardTime }) },
    centroId,
  );
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

// --- El tren de terapias: varias terapias desde UNA hora de entrada (BE PR #517) ---
// `start` = hora exacta del tramo (para enseñar); `slot` = franja de 30' en la que se agenda de verdad.
export interface TrainLegPlan {
  serviceId: string;
  start: string;
  slot: string;
  minutes: number;
  parallel: boolean;
  configured: boolean;
}
export interface TrainLegInfo {
  serviceId: string;
  configured: boolean;
  minutes: number;
  areas: number;
  resourceId: string | null;
  resourceSlug: string | null;
  blocking: boolean;
  trainWeight: number;
}
export interface TrainSlot {
  time: string;
  fits: boolean;
  reasonKey?: string | null;
  serviceId?: string | null; // qué terapia bloquea cuando no cabe
  resourceId?: string | null; // con varias líneas (BE PR #518), qué recurso de esa terapia bloquea
  endsAt: string;
  legs: TrainLegPlan[];
  staffBlocks: PatientDayStaffBlock[];
}
export interface PatientTrain {
  date: string;
  order: "weight" | "asked";
  legs: TrainLegInfo[];
  unconfiguredServiceIds: string[];
  patientMinutes: number;
  slots: TrainSlot[];
}
export function planPatientTrain(
  body: {
    date: string;
    serviceIds: string[];
    areas?: Record<string, number>;
    patientId?: string;
    keepOrder?: boolean;
  },
  centroId?: string,
): Promise<PatientTrain> {
  return apiFetch<PatientTrain>(`/resources/patient-train`, { method: "POST", body: JSON.stringify(body) }, centroId);
}

// Agenda TODO el tren de una vez, todo o nada (POST /frontdesk/sessions/book-train). `time` = la hora
// de entrada elegida en `planPatientTrain`; el BE agenda cada tramo en su `slot`, nunca el FE.
export type BookTrainResult = { sessions: Sesion[]; train: TrainSlot };
export function bookTrain(
  payload: { patientId: string; date: string; time: string; serviceIds: string[]; areas?: Record<string, number>; keepOrder?: boolean },
  centroId?: string,
): Promise<ConWarnings<BookTrainResult>> {
  return apiFetchEnvelope<BookTrainResult>(
    `/frontdesk/sessions/book-train`,
    { method: "POST", body: JSON.stringify(payload), headers: centroId ? { "X-Tenant-ID": centroId } : undefined },
  ).then((env) => ({
    data: env.data ?? { sessions: [], train: { time: payload.time, fits: false, endsAt: "", legs: [], staffBlocks: [] } },
    warnings: env.meta.warnings ?? [],
  }));
}

// --- Panorama del día por RECURSO × hora (GET /resources/day-occupancy) ---
// Un corte de TODOS los recursos del centro y sus tramos, sin pedir servicio: la «agenda del recurso» (rooms
// de láser, sillas de suero…) con puestos usados/libres por hora. Contrato verificado en prod 26-sep.
// `cappedBy`: `stations` (no quedan puestos → otra hora) | `staff` (no hay quien lo dé → poner a alguien) |
// null (queda hueco). `summary` = puestos-hora usados/disponibles y su % (el cuello de botella, ya calculado).
export interface OccupancyCell {
  time: string; // "HH:mm"
  used: number;
  // null = sin techo: un recurso `staff` (BE PR #518) sin turnos cargados para ese cargo — el motor
  // tampoco lo cierra (regla 5). Pintar «—», sin barra.
  free: number | null;
  cappedBy: "stations" | "staff" | null;
  // Solo en una sala de VARIOS cargos (npt_room: técnico y enfermera, BE PR #519): la respuesta de
  // cada cargo por separado. `free` de la celda ya es el mejor de ellos; esto es para el detalle.
  byRole?: Array<{ role: string; free: number; cappedBy: "stations" | "staff" | null }>;
}
export interface ResourceDayOccupancy {
  id: string;
  slug: string;
  name: string;
  labelKey: string;
  capacity: number;
  staffRole: string | null;
  staffOnShift: number | null; // gente de turno de ese cargo; null = sin techo humano (manda el puesto)
  cells: OccupancyCell[];
  // `available`/`pct` null junto con `free: null` de las celdas: mismo motivo, sin techo humano.
  summary: { used: number; available: number | null; pct: number | null };
}
export interface DayOccupancy {
  date: string;
  slots: string[]; // "07:00"…"17:00" — las genera el BE, NO inventarlas
  resources: ResourceDayOccupancy[];
}
export function getDayOccupancy(
  date: string,
  centroId?: string,
  centerIds?: string[],
): Promise<DayOccupancy> {
  const sp = new URLSearchParams({ date });
  for (const c of centerIds ?? []) sp.append("centerIds", c);
  return apiFetch<DayOccupancy>(`/resources/day-occupancy?${sp.toString()}`, {}, centroId);
}
