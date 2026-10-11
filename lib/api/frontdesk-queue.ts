import { apiFetch } from "./client";

// La cola por terapia (GET /frontdesk/queue, BE PR #420 + #421, verificado por HTTP en prod 10-oct-2026
// — ver docs/specs/cola-por-terapia-contrato-verificado.md). Por servicio: quién espera (ordenado por
// llegada, con turno y minutos de espera), quién está en terapia ahora, y quién está LIBRE para
// tomarlo (`free`, PR #421). `busyIn` en una entrada de `waiting` es el serviceId de la terapia en la
// que el paciente está ahora mismo — se pinta "ocupado en X" y NO cuenta como esperando esa terapia.
//
// El BE no manda `record` plano (lo que se había asumido del borrador de spec antes de que el
// endpoint existiera): manda `patientName`/`medicalRecordNumber` sueltos (de la cola misma) MÁS un
// `patient` anidado con el nombre ya en formato "Apellidos, Nombre" — lo agrega un interceptor
// global a cualquier objeto con `patientId` (regla del dueño 29-sep: "el paciente viaja con su
// récord"), así que está garantizado tanto en `waiting` como en `inTherapy`. Confirmado por BE
// 10-oct-2026 — se usa el anidado para mostrar, consistente con el resto de la app.
export type QueuePatientRef = {
  id: string;
  medicalRecordNumber: string | null;
  name: string;
};

export type QueueWaitingEntry = {
  sessionId: string;
  patientId: string;
  patientName: string;
  medicalRecordNumber: string | null;
  patient: QueuePatientRef;
  turn: number;
  arrivedAt: string; // ISO — primera llegada a ESTA terapia (ver el-turno-por-terapia.ts del BE)
  waitMinutes: number;
  busyIn: string | null; // serviceId de la terapia donde está en_terapia ahora, o null
  // "Llamar" (PR #423, desplegado y verificado 10-oct-2026): queda llamado SIN salir de `waiting` —
  // conserva su turno — hasta que la sesión pase a en_terapia de verdad.
  calledAt: string | null;
  technicianId: string | null;
  technicianName: string | null;
};

export type QueueInTherapyEntry = {
  sessionId: string;
  patientId: string;
  patientName: string;
  medicalRecordNumber: string | null;
  patient: QueuePatientRef;
  technicianId: string | null;
  technicianName: string | null;
  since: string; // ISO
  minutes: number;
  // Slice 3 del BE (PR #422, desplegado y verificado 10-oct-2026 con un paciente real). "history" =
  // mediana real de 30 días (la UI lo marca como aproximado); "resource" = calculado de la
  // configuración del recurso. null en cualquiera de los dos: no mostrar nada.
  estimatedEnd: string | null;
  estimateSource: "resource" | "history" | null;
};

// Técnico/enfermero LIBRE para esta terapia ahora mismo (PR #421), el menos cargado primero.
export type QueueFreeStaff = {
  staffId: string;
  name: string;
  load: number; // pacientes que atiende ahora mismo
};

// Sugerencia de a quién llamar para ESTA sesión en espera (PR #423) — un técnico libre puede
// sugerirse para varias sesiones a la vez; no es necesariamente `free[0]` repetido.
export type QueueSuggestion = {
  sessionId: string;
  staffId: string;
  staffName: string;
};

// TODO el personal de turno capaz de esta terapia (PR #425, desplegado y verificado 10-oct-2026),
// libres primero — a diferencia de `free` (solo los libres), este SÍ permite llamar a alguien
// ocupado a propósito cuando nadie está libre (lo que `free`+`suggestions` no dejaban hacer desde
// la UI). `available` es la fuente de verdad de si puede tomar el paciente ahora.
export type QueueOnShiftStaff = {
  staffId: string;
  name: string;
  load: number;
  available: boolean;
};

export type QueueService = {
  serviceId: string;
  key: string; // clave corta para el chip compacto de la lista (p. ej. "laser")
  name: string;
  color: string | null;
  icon: string | null;
  free: QueueFreeStaff[];
  onShift: QueueOnShiftStaff[];
  skillsConfigured: boolean; // false: nadie tiene esta terapia configurada como capacidad propia
  suggestions: QueueSuggestion[];
  waiting: QueueWaitingEntry[];
  inTherapy: QueueInTherapyEntry[];
};

export type FrontdeskQueue = {
  date: string;
  totals: { waiting: number; inTherapy: number }; // pacientes DISTINTOS, no sesiones
  services: QueueService[];
};

// GET /frontdesk/queue?date=&serviceId=&centerIds= — permiso frontdesk.read.
export function getFrontdeskQueue(
  date: string,
  params?: { serviceId?: string; centerIds?: string[] },
  centroId?: string,
): Promise<FrontdeskQueue> {
  const sp = new URLSearchParams({ date });
  if (params?.serviceId) sp.set("serviceId", params.serviceId);
  if (params?.centerIds?.length) sp.set("centerIds", params.centerIds.join(","));
  return apiFetch<FrontdeskQueue>(`/frontdesk/queue?${sp.toString()}`, {}, centroId);
}

// POST /frontdesk/sessions/:id/call — permiso frontdesk.call (PR #423). Sin `technicianId` usa el
// sugerido del BE (el libre menos cargado); si nadie está libre, responde 409 NOBODY_FREE
// (labelKey frontdesk.queue.nobody_free). Volver a llamar reasigna.
export function callQueueSession(
  sessionId: string,
  technicianId?: string,
  centroId?: string,
): Promise<unknown> {
  return apiFetch(
    `/frontdesk/sessions/${sessionId}/call`,
    { method: "POST", body: JSON.stringify(technicianId ? { technicianId } : {}) },
    centroId,
  );
}

// POST /frontdesk/sessions/:id/uncall — deshace el llamado (calledAt y técnico vuelven a null).
export function uncallQueueSession(sessionId: string, centroId?: string): Promise<unknown> {
  return apiFetch(`/frontdesk/sessions/${sessionId}/uncall`, { method: "POST" }, centroId);
}

// UNA sola llegada por paciente al día, no por terapia (PR #424, desplegado y verificado por BE
// 10-oct-2026 — regla del dueño: "el récord 103057 tiene Vit C + Intravenoso y se marcó presente dos
// veces"). Marca todas las terapias PENDIENTES del día con la misma transición de cada sesión; las que
// fallen su propia regla van en `failed` con su motivo, sin bloquear a las demás.
export type PresentPatientResult = {
  date: string;
  arrivedAt: string;
  marked: { sessionId: string; serviceId: string }[];
  failed: { sessionId: string; serviceId: string; reason: string }[];
};

export function presentPatient(
  patientId: string,
  date?: string,
  centroId?: string,
): Promise<PresentPatientResult> {
  return apiFetch<PresentPatientResult>(
    `/frontdesk/patients/${patientId}/present`,
    { method: "POST", body: JSON.stringify(date ? { date } : {}) },
    centroId,
  );
}

export function undoPresentPatient(patientId: string, centroId?: string): Promise<unknown> {
  return apiFetch(`/frontdesk/patients/${patientId}/undo-present`, { method: "POST" }, centroId);
}
