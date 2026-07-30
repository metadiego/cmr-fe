import { createClient } from "@/lib/supabase/client";
import { env } from "@/lib/env";
import { getActiveCentro } from "@/lib/tenant";
import { handleSessionExpired } from "@/lib/auth/session-expired";
import {
  ApiError,
  type ApiEnvelope,
  type ApiErrorShape,
  type Paginated,
} from "./types";

// Margen para considerar un access token "por vencer" y refrescarlo ANTES de la llamada (segundos).
const REFRESH_MARGEN_S = 60;

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
  let {
    data: { session },
  } = await supabase.auth.getSession();

  // Refresh PROACTIVO: si el token ya venció o le quedan <60s, refrescarlo antes de mandar la llamada para
  // no enviar un token muerto (raíz del 401 tras ~15 min, QA-001). Solo cuando hace falta; si el refresh
  // token también murió, se envía lo que haya y el 401 se maneja abajo (aviso claro).
  if (session?.expires_at) {
    const restanteS = session.expires_at - Math.floor(Date.now() / 1000);
    if (restanteS < REFRESH_MARGEN_S) {
      // Con try/catch: si el refresh proactivo falla por red, seguimos con el token actual (aún puede
      // servir unos segundos) y, si el BE lo rechaza, lo maneja el path del 401. No romper la petición aquí.
      try {
        const { data } = await supabase.auth.refreshSession();
        if (data.session) session = data.session;
      } catch {
        /* red caída: seguir con la sesión actual */
      }
    }
  }

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
  // Una corrida de la petición con los headers de auth frescos del momento.
  const doFetch = async () => {
    const auth = await authHeaders(tenant);
    const res = await fetch(`${env.API_BASE_URL}${path}`, {
      // Datos siempre frescos: el BE manda ETag y sin no-store el navegador servía
      // respuestas cacheadas (menú/tablero viejos aunque el dato ya cambió). Esta app
      // es data-driven/en-vivo → nunca queremos caché HTTP de la API.
      cache: "no-store",
      ...init,
      headers: {
        "Content-Type": "application/json",
        ...auth,
        ...init.headers,
      },
    });
    return { res, teniaToken: !!auth["Authorization"] };
  };

  let { res, teniaToken } = await doFetch();

  // 401 con token adjunto = el BE rechazó nuestra sesión. Intentar UN refresh y reintentar (recuperación
  // silenciosa cuando el refresh token sigue vivo). Solo si el REFRESH FALLA se considera la sesión muerta
  // → aviso CLARO + login (QA-001). Si el refresh funciona pero el reintento SIGUE en 401, NO es sesión
  // caducada (p. ej. 401 de recurso/tenant): se deja surgir como ApiError normal y NO se expulsa al usuario.
  if (res.status === 401 && teniaToken) {
    const refreshed = await createClient()
      .auth.refreshSession()
      .then(({ data }) => !!data.session)
      .catch(() => false);
    if (refreshed) {
      ({ res, teniaToken } = await doFetch());
    } else {
      handleSessionExpired();
    }
  }

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
  tenant?: string | null,
): Promise<Paginated<T>> {
  const envelope = await rawRequest<T[]>(path, init, tenant);
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
// `tenant`: undefined → default center; a string → force it; null → OMIT
// X-Tenant-ID (multi-center "combined" read, e.g. master viewing all centers).
export function apiFetchPaged<T>(
  path: string,
  init: RequestInit = {},
  tenant?: string | null,
): Promise<Paginated<T>> {
  return apiRequestPaged<T>(`/api/v1${path}`, init, tenant);
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
