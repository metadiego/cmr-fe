import { apiFetch } from "./client";

// La cola por terapia (BE handoff HANDOFF-cola-por-terapia.md, pendiente de desplegar a la fecha de
// este archivo — 10-oct-2026). Por servicio: quién espera (ordenado por llegada, con turno y minutos
// de espera) y quién está en terapia ahora. `busyIn` en una entrada de `waiting` es el serviceId de
// la terapia en la que el paciente está ahora mismo — se pinta "ocupado en X" y NO cuenta como
// esperando esa terapia (ya tiene su lugar reservado, solo no se le puede llamar todavía).
export type QueueWaitingEntry = {
  sessionId: string;
  patientId: string;
  patientName: string;
  record: string | null;
  turn: number;
  arrivedAt: string; // ISO — primera llegada a ESTA terapia (ver el-turno-por-terapia.ts del BE)
  waitMinutes: number;
  busyIn: string | null; // serviceId de la terapia donde está en_terapia ahora, o null
};

export type QueueInTherapyEntry = {
  sessionId: string;
  patientId: string;
  patientName: string;
  record: string | null;
  technicianId: string | null;
  technicianName: string | null;
  since: string; // ISO
  minutes: number;
};

export type QueueService = {
  serviceId: string;
  key: string; // clave corta para el chip compacto de la lista (p. ej. "laser")
  name: string;
  color: string | null;
  icon: string | null;
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
