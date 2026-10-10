// The patient desk turns the frontdesk around: instead of one tab per therapy with its patients, ONE list
// of the day's patients (service sessions and consultations together), each with everything they have
// today. This module does the grouping — pure, so it is tested.

import { coincide as matches } from "./search.ts";

export interface DaySession {
  id: string;
  patientId: string;
  serviceId: string;
  status?: string | null;
  time?: string | null;
  presentAt?: string | null;
  patient?: { id?: string; name?: string | null; medicalRecordNumber?: string | null } | null;
}

export interface DayConsultation {
  id: string;
  pacienteId?: string | null; // board rows of the consultation board (/board/rows) keep Spanish keys
  paciente?: unknown;
  record?: unknown;
  estado?: unknown;
  presente?: unknown;
}

export interface DayService {
  id: string;
  slug: string;
  name: string;
  color?: string | null;
}

export interface PatientService {
  serviceId: string;
  slug: string;
  name: string;
  color: string | null;
  sessionIds: string[];
  statuses: string[];
}

export interface PatientDay {
  patientId: string;
  name: string;
  record: string;
  services: PatientService[];
  consultationIds: string[];
  consultationStatuses: string[];
  earliestTime: string | null; // HH:MM of the first booking of the day
  presentAt: string | null; // first arrival stamp (any service or the consultation)
  allCancelled: boolean;
}

const text = (v: unknown) => (typeof v === "string" ? v : v == null ? "" : String(v));
const minIso = (a: string | null, b: string | null | undefined) => (!b ? a : !a || b < a ? b : a);

export function groupByPatient(sessions: DaySession[], consultations: DayConsultation[], services: DayService[]): PatientDay[] {
  const svc = new Map(services.map((s) => [s.id, s]));
  const map = new Map<string, PatientDay>();
  const get = (id: string, name: string, record: string) => {
    let p = map.get(id);
    if (!p) {
      p = { patientId: id, name, record, services: [], consultationIds: [], consultationStatuses: [], earliestTime: null, presentAt: null, allCancelled: true };
      map.set(id, p);
    }
    if (!p.name && name) p.name = name;
    if (!p.record && record) p.record = record;
    return p;
  };

  for (const s of sessions) {
    if (!s.patientId) continue;
    const p = get(s.patientId, text(s.patient?.name), text(s.patient?.medicalRecordNumber));
    const meta = svc.get(s.serviceId);
    let ps = p.services.find((x) => x.serviceId === s.serviceId);
    if (!ps) {
      ps = { serviceId: s.serviceId, slug: meta?.slug ?? "", name: meta?.name ?? "", color: meta?.color ?? null, sessionIds: [], statuses: [] };
      p.services.push(ps);
    }
    ps.sessionIds.push(s.id);
    ps.statuses.push(text(s.status));
    if (s.status !== "cancelada") p.allCancelled = false;
    p.earliestTime = minIso(p.earliestTime, s.time ? s.time.slice(0, 5) : null);
    p.presentAt = minIso(p.presentAt, s.presentAt);
  }

  for (const c of consultations) {
    const id = text(c.pacienteId);
    if (!id) continue;
    const p = get(id, text(c.paciente), text(c.record));
    p.consultationIds.push(c.id);
    const status = text(c.estado);
    p.consultationStatuses.push(status);
    if (status !== "cancelada") p.allCancelled = false;
    p.presentAt = minIso(p.presentAt, text(c.presente) || null);
  }

  // Services in the configured order (the order of `services`), not in arrival order.
  const order = new Map(services.map((s, i) => [s.id, i]));
  for (const p of map.values()) p.services.sort((a, b) => (order.get(a.serviceId) ?? 99) - (order.get(b.serviceId) ?? 99));

  return sortPatients([...map.values()]);
}

// Who is here first (by arrival), then who is booked earliest, then by name. Fully cancelled days last.
export function sortPatients(list: PatientDay[]): PatientDay[] {
  return list.slice().sort((a, b) => {
    if (a.allCancelled !== b.allCancelled) return a.allCancelled ? 1 : -1;
    if (a.presentAt && b.presentAt) return a.presentAt.localeCompare(b.presentAt);
    if (a.presentAt || b.presentAt) return a.presentAt ? -1 : 1;
    if (a.earliestTime && b.earliestTime && a.earliestTime !== b.earliestTime) return a.earliestTime.localeCompare(b.earliestTime);
    if (a.earliestTime !== b.earliestTime) return a.earliestTime ? -1 : 1;
    return a.name.localeCompare(b.name);
  });
}

// Accent- and case-insensitive search over name, record and the names of the patient's services.
export function filterPatients(list: PatientDay[], query: string): PatientDay[] {
  if (!query.trim()) return list;
  return list.filter((p) => matches([p.name, p.record, ...p.services.map((s) => s.name)], query));
}
