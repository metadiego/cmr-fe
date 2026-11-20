import { apiFetchPaged } from "./client";
import type { Paginated } from "./types";

// Sessions log (cmr-be #648, spec docs/specs/bitacora-de-sesiones.md, deployed 20-nov-2026):
// when each login started and ended, with IP/browser — separate from the general audit trail
// (lib/api/auditoria.ts), which logs actions, not sessions. Only data from the BE's deploy date
// onward exists; there is nothing to backfill before it.

export interface AuditSessionRow {
  userName: string | null;
  email: string;
  clinicName: string | null;
  startedAt: string;
  lastSeenAt: string;
  endedAt: string | null; // null = no "Salir" click yet (open, or the browser was just closed)
  ip: string | null;
  lastIp: string | null;
  userAgent: string | null;
  status: "open" | "closed";
  statusLabelKey: string;
}

export interface AuditSessionListParams {
  from?: string;
  to?: string;
  email?: string;
  authUserId?: string;
  status?: "open" | "closed";
  centerIds?: string[];
  page?: number;
  limit?: number;
}

export function listAuditSessions(
  params: AuditSessionListParams = {},
): Promise<Paginated<AuditSessionRow>> {
  const { centerIds, ...rest } = params;
  const sp = new URLSearchParams();
  for (const [k, v] of Object.entries(rest)) {
    if (v !== undefined && v !== null && `${v}` !== "") sp.set(k, String(v));
  }
  for (const id of centerIds ?? []) sp.append("centerIds", id);
  const qs = sp.toString();
  return apiFetchPaged<AuditSessionRow>(`/audit/sessions${qs ? `?${qs}` : ""}`, {}, null);
}
