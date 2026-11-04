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
  /** The appointment's own center: the tenant (X-Tenant-ID) for its cancel and move. */
  centerId?: string | null;
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
    centerId: c.clinicId ?? null,
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
    centerId: s.clinicId ?? null,
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

/** Today's appointment whose start time already passed (it is not offered Move or any change). */
export function startedToday(a: Pick<PatientAppointment, "date" | "time">, todayIso: string, nowTime: string): boolean {
  if (a.date !== todayIso || !a.time) return false;
  return a.time.slice(0, 5) < nowTime.slice(0, 5).padStart(5, "0");
}

export interface RailActions {
  move: boolean;
  edit: boolean;
  cancel: boolean;
}

/**
 * Which rail actions an upcoming appointment offers. The BE guard derives a "door" permission from
 * the HTTP verb (POST → .create) before the handler checks its own (.update), so:
 * - medical cancel / move (POST …/cancel, …/reschedule): citas.create AND citas.update;
 *   medical edit (PUT): citas.update.
 * - service cancel (POST …/sessions/:id/cancel): frontdesk.create AND frontdesk.update;
 *   service move (PATCH …/agenda): frontdesk.update. Services have no edit here.
 * Past appointments and today's that already started offer nothing.
 */
export function railActions(
  a: PatientAppointment,
  opts: { past: boolean; can: (permission: string) => boolean; todayIso: string; nowTime: string },
): RailActions {
  const none = { move: false, edit: false, cancel: false };
  if (opts.past || startedToday(a, opts.todayIso, opts.nowTime)) return none;
  const { can } = opts;
  if (a.kind === "medical") {
    const update = can("citas.update");
    const createAndUpdate = update && can("citas.create");
    return { move: createAndUpdate, edit: update, cancel: createAndUpdate };
  }
  const update = can("frontdesk.update");
  return { move: update, edit: false, cancel: update && can("frontdesk.create") };
}
