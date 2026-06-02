import { createClient } from "@/lib/supabase/client";
import { env } from "@/lib/env";
import { ApiError, type ApiEnvelope, type ApiErrorShape } from "./types";

// Reads the current Supabase session (browser) and builds auth + tenant headers.
// No session → no headers (the BE will respond 401, surfaced as an ApiError).
async function authHeaders(): Promise<Record<string, string>> {
  const supabase = createClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();

  const headers: Record<string, string> = {};
  if (session?.access_token) {
    headers["Authorization"] = `Bearer ${session.access_token}`;
    const clinicId = session.user.app_metadata?.clinic_id;
    if (clinicId) {
      headers["X-Tenant-ID"] = String(clinicId);
    }
  }
  return headers;
}

// Core request: takes an absolute path on the BE (e.g. "/api/health"),
// attaches auth/tenant headers, and unwraps the { data, meta } envelope.
export async function apiRequest<T>(
  path: string,
  init: RequestInit = {},
): Promise<T> {
  const auth = await authHeaders();

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
    );
  }

  return body == null ? (undefined as T) : (body as ApiEnvelope<T>).data;
}

// Convenience for versioned feature endpoints: apiFetch("/api-keys") → /api/v1/api-keys.
export function apiFetch<T>(path: string, init: RequestInit = {}): Promise<T> {
  return apiRequest<T>(`/api/v1${path}`, init);
}
