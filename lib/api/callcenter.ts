// Call Center dashboard (cmr-be #717, handoff .personal/handoff-callcenter-en-comunicaciones.md).
// Entirely ahead of the generated schema: `lib/api/schema.d.ts` still only has Phase 1's flat
// `calls`/`channels`/`live-at` shapes (no pagination envelope, no staffName/patientName, no
// statistics/missed-report/push-health/stream routes at all) because `npm run gen:api` hasn't run
// since PR #717 — every type below is hand-typed from the handoff, verified against prod responses.
//
// "Es UN solo call center": every read is COMBINED across centers by default (tenant = null, omits
// X-Tenant-ID), with an optional `centerIds` narrowing filter — never gated behind useCentroGate.

import { apiFetch, apiFetchPaged } from "./client";
import type { Paginated } from "./types";

export type CallDirection = "entrante" | "saliente" | "interna" | "facebook" | "marypili";
export type CallStatus = "desconocido" | "perdida" | "fallida" | "contestada" | "ocupada";
export type CallTab = "answered" | "missed" | "all";

export type CallBreakdown = {
  total: number;
  answered: number;
  missed: number;
  /** Percentage with one decimal (e.g. 82.2). */
  answerRate: number;
  avgTalkSeconds: number;
};

export type CallStatistics = {
  from: string;
  to: string;
  zone: string;
  totals: CallBreakdown;
  byDirection: (CallBreakdown & { direction: CallDirection })[];
  byChannel: (CallBreakdown & { channel: string })[];
  byOperator: (CallBreakdown & { extension: string; staffId: string | null; staffName: string | null })[];
  byHour: (CallBreakdown & { hour: number })[];
};

export function getCallStatistics(from: string, to: string, centroId?: string | null): Promise<CallStatistics> {
  const sp = new URLSearchParams({ from, to });
  return apiFetch<CallStatistics>(`/callcenter/statistics?${sp.toString()}`, {}, centroId);
}

export type MissedReport = {
  total: number;
  byHour: { hour: number; missed: number }[];
  byExtension: { extension: string; staffId: string | null; staffName: string | null; missed: number }[];
  peakHour: { hour: number; missed: number } | null;
  topExtension: { extension: string; staffId: string | null; staffName: string | null; missed: number } | null;
};

export function getMissedReport(
  from: string,
  to: string,
  direction?: CallDirection,
  centroId?: string | null,
): Promise<MissedReport> {
  const sp = new URLSearchParams({ from, to });
  if (direction) sp.set("direction", direction);
  return apiFetch<MissedReport>(`/callcenter/missed-report?${sp.toString()}`, {}, centroId);
}

export type Call = {
  id: string;
  pbx: string;
  from: string | null;
  toNumber: string | null;
  extension: string | null;
  /** The call's direction — named `address` in this v2 response (old glossary translation; the BE will fix it). */
  address: CallDirection | null;
  startedAt: string | null;
  answeredAt: string | null;
  endedAt: string | null;
  durationSeconds: number;
  talkTimeSeconds: number;
  status: CallStatus;
  channel: string;
  recordingFile: string | null;
  transcript: string | null;
  staffId: string | null;
  staffName: string | null;
  patientId: string | null;
  patientName: string | null;
  patientRecord: string | null;
  clinicName?: string | null;
};

export type ListCallsParams = {
  from: string;
  to: string;
  tab?: CallTab;
  channel?: string;
  extension?: string;
  staffId?: string;
  number?: string;
  direction?: CallDirection;
  page?: number;
  limit?: number;
};

export function listCalls(params: ListCallsParams, centroId?: string | null): Promise<Paginated<Call>> {
  const sp = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) if (v !== undefined && v !== "") sp.set(k, String(v));
  return apiFetchPaged<Call>(`/callcenter/calls?${sp.toString()}`, {}, centroId);
}

export type LiveCall = {
  id: string;
  pbx: string;
  extension: string;
  status: string;
  from: string | null;
  elapsedSeconds: number;
  agentReportedAt: string;
  clinicId: string | null;
  clinicName?: string | null;
};

export function getLiveCalls(centroId?: string | null): Promise<LiveCall[]> {
  return apiFetch<LiveCall[]>(`/callcenter/live-at`, {}, centroId);
}

export type PushHealth = {
  pbx: string;
  clinicId: string | null;
  lastCallAt: string | null;
  minutesSince: number | null;
  minutesBehind: number | null;
  withinHours: boolean;
  lagAlertMinutes: number;
  behind: boolean;
  hours: { days: number[]; start: string; end: string };
};

export function getPushHealth(centroId?: string | null): Promise<PushHealth[]> {
  return apiFetch<PushHealth[]>(`/callcenter/push-health`, {}, centroId);
}

// SSE event shape for /callcenter/stream (lib/api/citas-stream.ts's `subscribeCitas` parses the frame;
// this app never reads the typed `status` payload below — a `llamada` event only triggers a REST
// refetch — so it is documented here, not consumed, matching the handoff's own verified shape).
export type CallStreamStatus = {
  pbx: string;
  status: CallStatus;
  direction: CallDirection;
  channel: string;
  extension: string | null;
  staffId: string | null;
  patientId: string | null;
  startedAt: string | null;
};

// --- Configuration (callcenter.admin), handoff §7 — PER CENTER, unlike the dashboard reads above:
// an exception to "un solo call center" because lines and hours are configured per clinic.

export type CallcenterChannel = {
  id: string;
  number: string;
  channel: string;
  labelKey: string | null;
  active: boolean;
  clinicName?: string | null;
};

export type CallcenterChannelPayload = {
  number: string;
  channel: string;
  labelKey?: string;
  active?: boolean;
};

export function listCallcenterChannels(centroId?: string | null): Promise<CallcenterChannel[]> {
  return apiFetch<CallcenterChannel[]>(`/callcenter/channels`, {}, centroId);
}
export function createCallcenterChannel(payload: CallcenterChannelPayload, centroId?: string | null): Promise<CallcenterChannel> {
  return apiFetch<CallcenterChannel>(`/callcenter/channels`, { method: "POST", body: JSON.stringify(payload) }, centroId);
}
export function updateCallcenterChannel(
  id: string,
  payload: Partial<CallcenterChannelPayload>,
  centroId?: string | null,
): Promise<CallcenterChannel> {
  return apiFetch<CallcenterChannel>(`/callcenter/channels/${encodeURIComponent(id)}`, { method: "PUT", body: JSON.stringify(payload) }, centroId);
}
export function deleteCallcenterChannel(id: string, centroId?: string | null): Promise<void> {
  return apiFetch<void>(`/callcenter/channels/${encodeURIComponent(id)}`, { method: "DELETE" }, centroId);
}

export type CallcenterSettings = {
  centerId: string;
  timeZone: string;
  hours: { days: number[]; start: string; end: string };
  lagAlertMinutes: number;
};

export type CallcenterSettingsPayload = Partial<Pick<CallcenterSettings, "timeZone" | "hours" | "lagAlertMinutes">>;

export function getCallcenterSettings(centerId: string): Promise<CallcenterSettings> {
  return apiFetch<CallcenterSettings>(`/callcenter/settings?centerId=${encodeURIComponent(centerId)}`);
}
export function updateCallcenterSettings(centerId: string, payload: CallcenterSettingsPayload): Promise<CallcenterSettings> {
  return apiFetch<CallcenterSettings>(`/callcenter/settings?centerId=${encodeURIComponent(centerId)}`, {
    method: "PUT",
    body: JSON.stringify(payload),
  });
}
