import { createClient } from "@/lib/supabase/client";
import { env } from "@/lib/env";
import { getActiveCentro } from "@/lib/tenant";
import {
  ApiError,
  type ApiEnvelope,
  type ApiErrorShape,
  type Paginated,
} from "./types";

// Reads the current Supabase session (browser) and builds auth + tenant headers.
// No session → no headers (the BE will respond 401, surfaced as an ApiError).
// X-Tenant-ID comes from the user-selected active center (cookie), falling back
// to the session's app_metadata.clinic_id.
// `tenant`: undefined → default (active-center cookie / clinic_id); a string →
// force that center; null → OMIT X-Tenant-ID (multi-center "combined" reads).
async function authHeaders(
  tenant?: string | null,
): Promise<Record<string, string>> {
  const supabase = createClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();

  const headers: Record<string, string> = {};
  if (session?.access_token) {
    headers["Authorization"] = `Bearer ${session.access_token}`;
    const clinicId =
      tenant === null
        ? undefined
        : (tenant ?? getActiveCentro() ?? session.user.app_metadata?.clinic_id);
    if (clinicId) {
      headers["X-Tenant-ID"] = String(clinicId);
    }
  }
  return headers;
}

// Core fetch: attaches auth/tenant headers, parses the JSON body, and on a
// non-2xx response throws an ApiError (preserving the BE's labelKey for i18n).
// Returns the full { data, meta } envelope so callers can read pagination.
async function rawRequest<T>(
  path: string,
  init: RequestInit = {},
  tenant?: string | null,
): Promise<ApiEnvelope<T> | null> {
  const auth = await authHeaders(tenant);

  const res = await fetch(`${env.API_BASE_URL}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...auth,
      ...init.headers,
    },
  });

  const body: unknown =
    res.status === 204 ? null : await res.json().catch(() => null);

  if (!res.ok) {
    const err = (body as ApiErrorShape | null)?.error;
    throw new ApiError(
      err?.code ?? "INTERNAL_ERROR",
      err?.message ?? res.statusText,
      res.status,
      err?.details,
      err?.labelKey,
    );
  }

  return body == null ? null : (body as ApiEnvelope<T>);
}

// Core request: takes an absolute path on the BE (e.g. "/api/health"),
// attaches auth/tenant headers, and unwraps the { data, meta } envelope.
export async function apiRequest<T>(
  path: string,
  init: RequestInit = {},
  tenant?: string | null,
): Promise<T> {
  const envelope = await rawRequest<T>(path, init, tenant);
  return envelope == null ? (undefined as T) : envelope.data;
}

// Like apiRequest but keeps meta.pagination, returning { items, pagination }.
// Falls back to a single-page shape when the BE omits meta.pagination.
export async function apiRequestPaged<T>(
  path: string,
  init: RequestInit = {},
): Promise<Paginated<T>> {
  const envelope = await rawRequest<T[]>(path, init);
  const items = (envelope?.data ?? []) as T[];
  const pagination = envelope?.meta.pagination ?? {
    total: items.length,
    page: 1,
    limit: items.length,
  };
  return { items, pagination };
}

// Convenience for versioned feature endpoints: apiFetch("/api-keys") → /api/v1/api-keys.
export function apiFetch<T>(
  path: string,
  init: RequestInit = {},
  tenant?: string | null,
): Promise<T> {
  return apiRequest<T>(`/api/v1${path}`, init, tenant);
}

// Paginated variant of apiFetch (prefixes /api/v1).
export function apiFetchPaged<T>(
  path: string,
  init: RequestInit = {},
): Promise<Paginated<T>> {
  return apiRequestPaged<T>(`/api/v1${path}`, init);
}

// Like apiFetch but returns the FULL envelope ({ data, meta }) so callers can
// read meta extras (e.g. meta.advertencias on cita create). Prefixes /api/v1.
export async function apiFetchEnvelope<T>(
  path: string,
  init: RequestInit = {},
): Promise<ApiEnvelope<T>> {
  const envelope = await rawRequest<T>(`/api/v1${path}`, init);
  return (
    envelope ?? { data: undefined as T, meta: { timestamp: "", requestId: "" } }
  );
}
