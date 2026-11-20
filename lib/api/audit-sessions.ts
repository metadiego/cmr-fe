import { apiFetchPaged } from "./client";
import type { Paginated } from "./types";

// Sessions log (cmr-be #648, spec docs/specs/bitacora-de-sesiones.md, deployed 20-nov-2026):
// when each login started and ended, with IP/browser — separate from the general audit trail
// (lib/api/auditoria.ts), which logs actions, not sessions. Only data from the BE's deploy date
// onward exists; there is nothing to backfill before it.

export interface AuditSessionRow {
  id: string;
  sessionId: string;
  authUserId: string;
  clinicId: string | null;
  userName: string | null;
  email: string;
  clinicName: string | null;
  startedAt: string;
  lastSeenAt: string;
  endedAt: string | null; // null = no "Salir" click yet (open, or the browser was just closed)
  endReason: string | null;
  ip: string | null;
  lastIp: string | null;
  userAgent: string | null;
  status: "open" | "closed";
  statusLabelKey: string;
}

export interface AuditSessionListParams {
  from?: string;
  to?: string;
  /** Only sessions still active at or after this instant (ISO) — the "who is in the system now" view. */
  activeSince?: string;
  email?: string;
  authUserId?: string;
  status?: "open" | "closed";
  centerIds?: string[];
  page?: number;
  limit?: number;
}

function sessionsQuery(params: Record<string, unknown>, centerIds?: string[]): string {
  const sp = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== null && `${v}` !== "") sp.set(k, String(v));
  }
  for (const id of centerIds ?? []) sp.append("centerIds", id);
  const qs = sp.toString();
  return qs ? `?${qs}` : "";
}

export function listAuditSessions(
  params: AuditSessionListParams = {},
): Promise<Paginated<AuditSessionRow>> {
  const { centerIds, ...rest } = params;
  return apiFetchPaged<AuditSessionRow>(`/audit/sessions${sessionsQuery(rest, centerIds)}`, {}, null);
}

// Per person, per day: cmr-be #652 (deployed 20-nov-2026). Answers "who was in the system and how
// much" without reading every raw session row — one row per person per day they were active.
export interface AuditSessionDayRow {
  authUserId: string;
  userName: string | null;
  email: string;
  clinicId: string | null;
  clinicName: string | null;
  day: string; // "YYYY-MM-DD", clinic-local
  firstSeenAt: string;
  lastSeenAt: string;
  sessions: number;
  ips: string[];
  actions: number;
}

export interface AuditSessionDaysParams {
  from?: string;
  to?: string;
  email?: string;
  authUserId?: string;
  centerIds?: string[];
  page?: number;
  limit?: number;
}

export function listAuditSessionDays(
  params: AuditSessionDaysParams = {},
): Promise<Paginated<AuditSessionDayRow>> {
  const { centerIds, ...rest } = params;
  return apiFetchPaged<AuditSessionDayRow>(`/audit/sessions/days${sessionsQuery(rest, centerIds)}`, {}, null);
}
