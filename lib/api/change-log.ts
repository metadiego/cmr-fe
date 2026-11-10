// The change log with undo, and the confirmation policies (BE #529, handoff
// docs/specs/registro-de-cambios-y-confirmacion-handoff.md). Field names read from a real prod response.
import { apiFetch, apiFetchPaged } from "./client";
import type { Paginated } from "./types";

export interface ChangeSet {
  fields: string[];
  before: Record<string, unknown> | null;
  after: Record<string, unknown> | null;
}
export interface ChangeLogEntry {
  id: string;
  clinicId: string;
  clinicName?: string | null;
  createdAt: string;
  entityType: string;
  entityId: string;
  action: string;
  actorKind: "user" | "api-key" | "system" | string;
  actorName: string | null;
  actorStaffId?: string | null;
  actorProfileId?: string | null;
  patientId?: string | null;
  patient?: { id?: string; record?: string | null; name?: string | null; nombre?: string | null } | null;
  businessDate?: string | null;
  reason?: string | null;
  requestId?: string | null;
  undoesEntryId?: string | null;
  undoneAt?: string | null;
  undoneByName?: string | null;
  /** «2026-11-06 19:31:54», already in the center's time: shown as is. */
  localTime: string;
  changeSet: ChangeSet;
}

export interface ChangeLogFilter {
  entityType?: string;
  entityId?: string;
  patientId?: string;
  date?: string;
  actorStaffId?: string;
  from?: string;
  to?: string;
  requestId?: string;
  centerIds?: string[];
  page?: number;
  limit?: number;
}

export function listChangeLog(f: ChangeLogFilter, centerId?: string | null): Promise<Paginated<ChangeLogEntry>> {
  const sp = new URLSearchParams();
  for (const [k, v] of Object.entries(f)) {
    if (v == null || v === "") continue;
    if (Array.isArray(v)) v.forEach((x) => sp.append(k, String(x)));
    else sp.set(k, String(v));
  }
  return apiFetchPaged<ChangeLogEntry>(`/change-log?${sp.toString()}`, {}, centerId);
}

/** Undoes the whole click the entry belongs to. Answers 428 first (change_log.undo): the client asks. */
export function undoChange(id: string, reason: string | undefined, centerId?: string): Promise<unknown> {
  return apiFetch(`/change-log/${encodeURIComponent(id)}/undo`, { method: "POST", body: JSON.stringify(reason ? { reason } : {}) }, centerId);
}

export interface ConfirmationPolicy {
  key: string;
  labelKey: string;
  requiredByDefault: boolean;
  centers: Array<{ clinicId: string; required: boolean; isDefault: boolean }>;
}
export function listConfirmationPolicies(centerIds?: string[]): Promise<ConfirmationPolicy[]> {
  const sp = new URLSearchParams();
  for (const c of centerIds ?? []) sp.append("centerIds", c);
  const qs = sp.toString();
  return apiFetch<ConfirmationPolicy[]>(`/confirmation-policies${qs ? `?${qs}` : ""}`, {}, null);
}
export function setConfirmationPolicy(actionKey: string, required: boolean, centerIds: string[]): Promise<unknown> {
  return apiFetch(`/confirmation-policies/${encodeURIComponent(actionKey)}`, { method: "PUT", body: JSON.stringify({ required, centerIds }) }, centerIds[0]);
}
