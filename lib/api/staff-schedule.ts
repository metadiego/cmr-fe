import type { components } from "./schema";
import { apiFetch } from "./client";
import type { ScheduleRow } from "../personal/schedule";

// A person's agenda = their «Horario» (cmr-be handoff rol-de-acceso-funciones-y-horario §2.3). The route
// name `doctors/` is historical: it holds everyone's agenda. Rules this module enforces:
// - every write names its center (`centerId` in the body AND as tenant): without it, a row lands in
//   the session's center, which is how rows with the wrong center were born;
// - writes on a person's rows need `staff.update` at the row's center; reads `staff.read`.

type ScheduleResponse = components["schemas"]["StaffScheduleResponseDto"] & { clinicName?: string | null };

const toRow = (r: ScheduleResponse): ScheduleRow => ({
  id: r.id,
  staffId: r.staffId ?? null,
  clinicId: r.clinicId,
  clinicName: r.clinicName ?? null,
  dayOfWeek: r.dayOfWeek,
  startTime: r.startTime.slice(0, 5),
  endTime: r.endTime.slice(0, 5),
  active: r.active,
});

/** The person's rows in `centerIds`, plus each center's general rows for the days they have none there. */
export async function getStaffSchedule(staffId: string, centerIds: readonly string[]): Promise<ScheduleRow[]> {
  const q = new URLSearchParams({ staffId });
  if (centerIds.length) q.set("centerIds", centerIds.join(","));
  const res = await apiFetch<ScheduleResponse[] | { items: ScheduleResponse[] }>(`/doctors/schedules?${q.toString()}`);
  const list = Array.isArray(res) ? res : (res?.items ?? []);
  return list.map(toRow);
}

export interface NewScheduleRow {
  staffId: string;
  centerId: string;
  dayOfWeek: number;
  startTime: string;
  endTime: string;
}

export function createScheduleRow(row: NewScheduleRow): Promise<unknown> {
  return apiFetch(`/doctors/schedules`, { method: "POST", body: JSON.stringify(row) }, row.centerId);
}

/** Same hours on several days of ONE center (upsert per day there). */
export function createScheduleRows(row: Omit<NewScheduleRow, "dayOfWeek"> & { daysOfWeek: number[] }): Promise<unknown> {
  return apiFetch(`/doctors/schedules/bulk`, { method: "POST", body: JSON.stringify(row) }, row.centerId);
}

/** Hours only: a PUT never moves a row to another center (see moveCenterSteps). */
export function updateScheduleRow(id: string, centerId: string, body: { startTime: string; endTime: string }): Promise<unknown> {
  return apiFetch(`/doctors/schedules/${id}`, { method: "PUT", body: JSON.stringify(body) }, centerId);
}

/** The BE's DELETE deactivates the row (`active=false`): «that day they do not work there». */
export function deactivateScheduleRow(id: string, centerId: string): Promise<void> {
  return apiFetch<void>(`/doctors/schedules/${id}`, { method: "DELETE" }, centerId);
}
