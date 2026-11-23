import { apiFetch } from "./client";
import type { ApiKey } from "@/lib/api-keys/key-status";

// API keys (machines and scripts). Contract: cmr-be docs/specs/api-keys-admin.md. Everything here
// needs full access (api_keys.manage). The plain key comes back ONCE, from create, and never again.
//
// Every call omits X-Tenant-ID (tenant = null): keys are managed across ALL centers. With the top
// bar's center sent, the BE narrows an admin to that center, so the list hid every all-centers key
// (all the full-access ones) and the other center's keys, revoke 404'd on them, and an all-centers
// key created there was stamped with that center (TenantScopeSubscriber fills a null clinicId).
const ALL_CENTERS_TENANT = null;
export type { ApiKey } from "@/lib/api-keys/key-status";

export type ApiKeyStatusFilter = "active" | "revoked" | "expired" | "all";

export interface CreateApiKeyPayload {
  name: string;
  permissions: string[];
  scope: "clinic" | "admin";
  clinicId?: string;
  expiresAt?: string;
}

export type CreatedApiKey = ApiKey & { plainKey: string };

function asArray<T>(res: unknown): T[] {
  if (Array.isArray(res)) return res as T[];
  const items = (res as { items?: unknown } | null)?.items;
  return Array.isArray(items) ? (items as T[]) : [];
}

export async function getApiKeys(status: ApiKeyStatusFilter = "all"): Promise<ApiKey[]> {
  return asArray<ApiKey>(await apiFetch(`/api-keys?status=${status}`, {}, ALL_CENTERS_TENANT));
}

export function createApiKey(payload: CreateApiKeyPayload): Promise<CreatedApiKey> {
  return apiFetch<CreatedApiKey>(`/api-keys`, { method: "POST", body: JSON.stringify(payload) }, ALL_CENTERS_TENANT);
}

// Guarded by the confirmation shield: apiFetch shows the BE's 428 dialog and repeats on «Aceptar».
export function revokeApiKey(id: string): Promise<void> {
  return apiFetch<void>(`/api-keys/${id}`, { method: "DELETE" }, ALL_CENTERS_TENANT);
}
