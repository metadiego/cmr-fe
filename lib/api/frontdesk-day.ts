// Reopen a cancelled session the same day; cancel / reopen a patient's whole day (BE #508, handoff
// docs/specs/reabrir-sesion-el-mismo-dia-handoff.md). Permission: frontdesk.update, the same as cancel.
import type { components } from "./schema";
import { apiFetch } from "./client";
import type { Sesion } from "./frontdesk";
import type { SkippedReopen } from "@/lib/frontdesk/reopen";

type ReopenSessionBody = components["schemas"]["ReopenSessionDto"];
type CancelDayBody = components["schemas"]["CancelPatientDayDto"];
type ReopenDayBody = components["schemas"]["ReopenPatientDayDto"];

const post = (body: unknown) => ({ method: "POST", body: JSON.stringify(body) });

/** Back to where its flow had got (pendiente / presente / en_terapia), keeping dose, staff and forms. */
export function reopenSession(sessionId: string, reason?: string, centerId?: string): Promise<Sesion> {
  const body: ReopenSessionBody = reason ? { reason } : {};
  return apiFetch<Sesion>(`/frontdesk/sessions/${encodeURIComponent(sessionId)}/reopen`, post(body), centerId);
}

/** Cancels the patient's pendiente / presente / en_terapia sessions of that day; asistido is never touched. */
export function cancelPatientDay(
  patientId: string,
  reason: string,
  centerId?: string,
  date?: string,
): Promise<{ cancelled: Sesion[]; count: number }> {
  const body: CancelDayBody = { reason, ...(centerId ? { centerId } : {}), ...(date ? { date } : {}) };
  return apiFetch(`/frontdesk/patients/${encodeURIComponent(patientId)}/day/cancel`, post(body), centerId);
}

/** Reopens ONLY today's cancelled sessions; open ones are left alone. `skipped` says which did not and why. */
export function reopenPatientDay(
  patientId: string,
  centerId?: string,
): Promise<{ reopened: Sesion[]; skipped: SkippedReopen[] }> {
  const body: ReopenDayBody = centerId ? { centerId } : {};
  return apiFetch(`/frontdesk/patients/${encodeURIComponent(patientId)}/day/reopen`, post(body), centerId);
}
