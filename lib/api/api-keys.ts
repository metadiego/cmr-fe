import { apiFetch } from "./client";
import type { ApiKey } from "@/lib/api-keys/key-status";

// API keys (machines and scripts). Contract: cmr-be docs/specs/api-keys-admin.md. Everything here
// needs full access (api_keys.manage). The plain key comes back ONCE, from create, and never again.
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
  return asArray<ApiKey>(await apiFetch(`/api-keys?status=${status}`));
}

export function createApiKey(payload: CreateApiKeyPayload): Promise<CreatedApiKey> {
  return apiFetch<CreatedApiKey>(`/api-keys`, { method: "POST", body: JSON.stringify(payload) });
}

// Guarded by the confirmation shield: apiFetch shows the BE's 428 dialog and repeats on «Aceptar».
export function revokeApiKey(id: string): Promise<void> {
  return apiFetch<void>(`/api-keys/${id}`, { method: "DELETE" });
}
