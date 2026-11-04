import type { Cita } from "../../api/citas.ts";
import type { Sesion } from "../../api/frontdesk.ts";
import { normalizeTime } from "./availability.ts";

// One shape for a patient's medical appointments (citas) and service sessions (sesiones).

export interface PatientAppointment {
  id: string;
  kind: "medical" | "service";
  typeId: string;
  date: string;
  time: string | null; // HH:mm
  status: string;
  withLabel: string | null;
  isLive: boolean;
}

export const MEDICAL_LIVE = ["programada", "confirmada", "presente", "triage", "en_consulta"];
export const SERVICE_LIVE = ["pendiente", "presente", "en_terapia"];

export function fromCita(c: Cita): PatientAppointment {
  return {
    id: c.id,
    kind: "medical",
    typeId: c.appointmentTypeId,
    date: c.date,
    time: c.time ? normalizeTime(c.time) : null,
    status: c.status,
    withLabel: c.doctorName ?? null,
    isLive: MEDICAL_LIVE.includes(c.status),
  };
}

// The session entity only carries staff ids (technicianId, nurseId, doctorId), no display name, so there
// is no label to show.
export function fromSesion(s: Sesion): PatientAppointment {
  return {
    id: s.id,
    kind: "service",
    typeId: s.serviceId,
    date: s.date,
    time: s.time ? normalizeTime(s.time) : null,
    status: s.status,
    withLabel: null,
    isLive: SERVICE_LIVE.includes(s.status),
  };
}

function cmp(a: PatientAppointment, b: PatientAppointment): number {
  if (a.date !== b.date) return a.date < b.date ? -1 : 1;
  if (a.time === b.time) return 0;
  if (a.time === null) return 1;
  if (b.time === null) return -1;
  return a.time < b.time ? -1 : 1;
}

export function splitUpcomingPast(
  items: PatientAppointment[],
  todayIso: string,
  pastLimit = 5,
): { upcoming: PatientAppointment[]; past: PatientAppointment[] } {
  // `reprogramada` has a successor row that carries the appointment forward.
  const kept = items.filter((i) => i.status !== "reprogramada");
  const isUpcoming = (i: PatientAppointment) => i.isLive && i.date >= todayIso;
  const upcoming = kept.filter(isUpcoming).sort(cmp);
  const past = kept
    .filter((i) => !isUpcoming(i))
    .sort((a, b) => cmp(b, a))
    .slice(0, pastLimit);
  return { upcoming, past };
}
