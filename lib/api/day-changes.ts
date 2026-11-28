import type { components } from "./schema";
import { apiFetch } from "./client";

// One-day changes of a person (cmr-be handoff §2.4): another center or other hours for one date, or
// «not coming» (`centerId: null`). Nothing reads them yet (booking will, in the BE's PR 3). The list has
// no response DTO in the OpenAPI: typed from the BE's DayChangeView.

export interface DayChange {
  /** YYYY-MM-DD */
  day: string;
  centerId: string | null;
  startTime: string | null;
  endTime: string | null;
  note: string | null;
  createdBy: string | null;
}

export type SetDayChangeBody = components["schemas"]["SetDayChangeDto"];

/** From `from` (default: today at the person's home center). Reads with `staff.read` at the home center. */
export function getDayChanges(staffId: string, centerId: string | undefined, from?: string): Promise<DayChange[]> {
  const q = from ? `?from=${encodeURIComponent(from)}` : "";
  return apiFetch<DayChange[]>(`/staff/${staffId}/day-changes${q}`, {}, centerId);
}

/** 400 `dayChanges.pastDay` for a past day. */
export function setDayChange(staffId: string, day: string, body: SetDayChangeBody, centerId?: string): Promise<DayChange> {
  return apiFetch<DayChange>(`/staff/${staffId}/day-changes/${day}`, { method: "PUT", body: JSON.stringify(body) }, centerId);
}

export function deleteDayChange(staffId: string, day: string, centerId?: string): Promise<void> {
  return apiFetch<void>(`/staff/${staffId}/day-changes/${day}`, { method: "DELETE" }, centerId);
}
