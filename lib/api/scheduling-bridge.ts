import { apiFetch } from "./client";

// Call-center appointment sync bridge (Google Sheets → our appointments). Handoff
// docs/specs/scheduling-bridge-handoff-fe.md. All reads/writes are tenant-scoped
// (X-Tenant-ID via the `centroId` param); the endpoints also accept `?centerIds=`
// for a combined multi-center view, used only by the status overview below.

export interface ClinicStatus {
  clinicId: string;
  enabled: boolean;
  externalClinicCode: string | null;
  pollIntervalSeconds: number;
  workDays: number[];
  workStartTime: string;
  workEndTime: string;
  lastRun: SyncRun | null;
}

export interface StatusResponse {
  reachable: boolean;
  clinics: ClinicStatus[];
}

export function getStatus(centerIds: string[]): Promise<StatusResponse> {
  const sp = new URLSearchParams();
  for (const id of centerIds) sp.append("centerIds", id);
  const qs = sp.toString();
  return apiFetch<StatusResponse>(`/scheduling-bridge/status${qs ? `?${qs}` : ""}`);
}

// Forma REAL del BE (verificada en vivo 2026-09-22): los contadores son `*Count` y el error es
// `firstError`; NO hay `ok` (se deriva de errorCount === 0). La pantalla leía `ok/created/updated/
// cancelled/error` —campos que ya no existen— y por eso pintaba «Falló» y sin números.
export interface SyncRun {
  id: string;
  clinicId: string;
  startedAt: string;
  finishedAt: string | null;
  createdCount: number;
  updatedCount: number;
  cancelledCount: number;
  skippedCount: number;
  errorCount: number;
  firstError: string | null;
}

// Una corrida salió bien si terminó y no acumuló errores. Único lugar donde se decide «ok».
export function runOk(r: SyncRun): boolean {
  return !!r.finishedAt && r.errorCount === 0;
}

export function listRuns(centroId?: string): Promise<SyncRun[]> {
  return apiFetch<SyncRun[]>(`/scheduling-bridge/runs`, {}, centroId);
}

export interface RunNowResult {
  ok: boolean;
  reason?: string;
}

export function runNow(clinicId: string, dates: string[], centroId?: string): Promise<RunNowResult> {
  return apiFetch<RunNowResult>(
    `/scheduling-bridge/run-now`,
    { method: "POST", body: JSON.stringify({ clinicId, dates }) },
    centroId,
  );
}

export interface BridgeConfig {
  enabled: boolean;
  pollIntervalSeconds: number;
  // Verificado en vivo: un centro nunca configurado la devuelve null, no [] — nunca asumir array.
  workDays: number[] | null;
  workStartTime: string;
  workEndTime: string;
  externalClinicCode: "BAYAMON" | "CAGUAS" | null;
}

const DEFAULT_CONFIG: BridgeConfig = {
  enabled: false,
  pollIntervalSeconds: 300,
  workDays: null,
  workStartTime: "",
  workEndTime: "",
  externalClinicCode: null,
};

// GET responds with `data` as an ARRAY (verified live — the endpoint shares the same
// ?centerIds= multi-center shape as /status), even when scoped to one center via
// X-Tenant-ID: [{...}]. PUT's response is a single object, not an array — different shape
// for the same resource. Scoped to this one center, so take the first (only) entry; a
// center with no row yet (empty array) falls back to a sensible default instead of
// undefined, so the form doesn't get stuck showing "loading" forever.
export async function getConfig(centroId?: string): Promise<BridgeConfig> {
  const res = await apiFetch<BridgeConfig[] | BridgeConfig>(`/scheduling-bridge/config`, {}, centroId);
  if (Array.isArray(res)) return res[0] ?? DEFAULT_CONFIG;
  return res;
}

// PUT is a partial update — send only the fields that changed.
export function updateConfig(payload: Partial<BridgeConfig>, centroId?: string): Promise<BridgeConfig> {
  return apiFetch<BridgeConfig>(
    `/scheduling-bridge/config`,
    { method: "PUT", body: JSON.stringify(payload) },
    centroId,
  );
}

export interface DoctorMapping {
  id: string;
  clinicId: string;
  externalName: string;
  staffId: string;
  createdAt: string;
  updatedAt: string;
}

export function listDoctorMappings(centroId?: string): Promise<DoctorMapping[]> {
  return apiFetch<DoctorMapping[]>(`/scheduling-bridge/doctor-mappings`, {}, centroId);
}
export function createDoctorMapping(
  payload: { externalName: string; staffId: string },
  centroId?: string,
): Promise<DoctorMapping> {
  return apiFetch<DoctorMapping>(
    `/scheduling-bridge/doctor-mappings`,
    { method: "POST", body: JSON.stringify(payload) },
    centroId,
  );
}
export function updateDoctorMapping(
  id: string,
  payload: { externalName?: string; staffId?: string },
  centroId?: string,
): Promise<DoctorMapping> {
  return apiFetch<DoctorMapping>(
    `/scheduling-bridge/doctor-mappings/${id}`,
    { method: "PUT", body: JSON.stringify(payload) },
    centroId,
  );
}
export function deleteDoctorMapping(id: string, centroId?: string): Promise<void> {
  return apiFetch<void>(`/scheduling-bridge/doctor-mappings/${id}`, { method: "DELETE" }, centroId);
}

export interface AgentMapping {
  id: string;
  clinicId: string;
  externalCode: string;
  staffId: string;
  createdAt: string;
  updatedAt: string;
}

export function listAgentMappings(centroId?: string): Promise<AgentMapping[]> {
  return apiFetch<AgentMapping[]>(`/scheduling-bridge/agent-mappings`, {}, centroId);
}
export function createAgentMapping(
  payload: { externalCode: string; staffId: string },
  centroId?: string,
): Promise<AgentMapping> {
  return apiFetch<AgentMapping>(
    `/scheduling-bridge/agent-mappings`,
    { method: "POST", body: JSON.stringify(payload) },
    centroId,
  );
}
export function updateAgentMapping(
  id: string,
  payload: { externalCode?: string; staffId?: string },
  centroId?: string,
): Promise<AgentMapping> {
  return apiFetch<AgentMapping>(
    `/scheduling-bridge/agent-mappings/${id}`,
    { method: "PUT", body: JSON.stringify(payload) },
    centroId,
  );
}
export function deleteAgentMapping(id: string, centroId?: string): Promise<void> {
  return apiFetch<void>(`/scheduling-bridge/agent-mappings/${id}`, { method: "DELETE" }, centroId);
}
