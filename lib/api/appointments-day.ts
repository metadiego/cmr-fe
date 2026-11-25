import { apiFetch } from "./client";
import { cancelarCita, confirmarCita, unconfirmCita } from "./citas";
import { cancelarSesion, confirmSession, reagendarSesion, unconfirmSession } from "./frontdesk";
import type { DayListRow } from "@/lib/appointments-day/day-list";

export type { DayListRow } from "@/lib/appointments-day/day-list";

// `GET /api/v2/appointments/day` (cmr-be piece 4a): one day's medical appointments and therapy sessions
// in one list, each row with its `allowedActions`. Permission: `appointments.read` or `frontdesk.read`;
// each kind is read only where its own one is held. Hand-off:
// docs/specs/appointment-lifecycle-switch-fe.md §5. Not in schema.d.ts until gen:api runs against 4a.
//
// `search` comes from lib/appointments-day/day-list.ts `dayListSearch`. X-Tenant-ID is the picked center,
// so the guard checks a center where the person reads.
export async function getAppointmentsDay(search: URLSearchParams, centerId?: string): Promise<DayListRow[]> {
  const res = await apiFetch<unknown>(`/appointments/day?${search.toString()}`, {}, centerId);
  return Array.isArray(res) ? (res as DayListRow[]) : [];
}

// The row's own doors, in the row's center (sent as X-Tenant-ID, as every write here does).
type Row = Pick<DayListRow, "id" | "kind" | "centerId">;

export function confirmDayRow(row: Row): Promise<unknown> {
  return row.kind === "medical" ? confirmarCita(row.id, row.centerId) : confirmSession(row.id, row.centerId);
}

export function unconfirmDayRow(row: Row): Promise<unknown> {
  return row.kind === "medical" ? unconfirmCita(row.id, row.centerId) : unconfirmSession(row.id, row.centerId);
}

/** Cancel (or, on an arrived row, "not served": the backend picks by the row's stage). Reason required. */
export function cancelDayRow(row: Row, reason: string): Promise<unknown> {
  return row.kind === "medical"
    ? cancelarCita(row.id, reason, row.centerId)
    : cancelarSesion(row.id, reason, row.centerId);
}

/** Move a therapy session in place (`move`): `PATCH frontdesk/sessions/:id/agenda`. */
export function moveSession(row: Row, date: string, time?: string): Promise<unknown> {
  return reagendarSesion(row.id, date, row.centerId, time);
}
