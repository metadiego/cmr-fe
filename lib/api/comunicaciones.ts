import type { components } from "./schema";
import { apiFetch } from "./client";
import { createClient } from "@/lib/supabase/client";
import { env } from "@/lib/env";

// Comunicaciones = dominio ÚNICO que fusiona alertas (canal interno/campana) +
// notificaciones (canales salientes). Ruta canónica /comunicaciones (los alias
// /alertas y /notificaciones están deprecados — NO usarlos). Verificado prod 2026-07-13.

// metadata viene como Record<string,never> en OpenAPI (quirk) → lo tipamos usable.
export type Alerta = Omit<components["schemas"]["AlertaEntity"], "metadata"> & {
  metadata: Record<string, unknown> | null;
};
// El BE agregó `dominio` (inventario|caja|clinico|agenda|…) y `color` (clave SEMÁNTICA: verde|ambar|
// rojo|azul|violeta|gris, NO un hex) a cada tipo — la campana los mapea a la paleta. El schema generado
// aún no los refleja (drift pendiente de gen:api). Ambos null = caer al color por severidad.
// Handoff alertas-color-campanita.
export type TipoAlerta = components["schemas"]["TipoAlertaEntity"] & {
  domain?: string | null;
  color?: string | null; // se dice igual (CAMPOS_IGUALES)
};
export type Notificacion = components["schemas"]["NotificacionEntity"];
export type Plantilla = components["schemas"]["PlantillaNotificacionEntity"];
export type EnviarNotificacionPayload = components["schemas"]["EnviarNotificacionDto"];
export type CreatePlantillaPayload = components["schemas"]["CreatePlantillaDto"];

// GET /alertas responde { data:[...], noLeidas } (doble-anidado; apiFetch quita el
// envelope externo → aquí llega ya como { data, noLeidas }).
export interface AlertasResponse {
  data: Alerta[];
  noLeidas: number;
}

export function listAlertas(): Promise<AlertasResponse> {
  return apiFetch<AlertasResponse>(`/comunicaciones/alertas`);
}
export function marcarLeida(id: string): Promise<unknown> {
  return apiFetch(`/comunicaciones/alertas/${id}/leer`, { method: "POST" });
}
export function acusarAlerta(id: string): Promise<unknown> {
  return apiFetch(`/comunicaciones/alertas/${id}/acusar`, { method: "POST" });
}
export function resolverAlerta(id: string): Promise<unknown> {
  return apiFetch(`/comunicaciones/alertas/${id}/resolver`, { method: "POST" });
}
export function descartarAlerta(id: string): Promise<unknown> {
  return apiFetch(`/comunicaciones/alertas/${id}/descartar`, { method: "POST" });
}
export function listTiposAlerta(): Promise<TipoAlerta[]> {
  return apiFetch<TipoAlerta[]>(`/comunicaciones/tipos-alerta`);
}

// Ruta en la app para una alerta accionable (deep-link por su origen/metadata).
export function alertaHref(a: Alerta): string | null {
  const tid =
    (a.metadata?.transferenciaId as string | undefined) ??
    (a.origenEntidad === "transferencia_inventario" ? a.origenId ?? undefined : undefined);
  if (tid) return `/inventario/transferencias/${tid}`;
  return null;
}

// Notificaciones (canales salientes).
export function listNotificaciones(citaId?: string): Promise<Notificacion[]> {
  const qs = citaId ? `?citaId=${encodeURIComponent(citaId)}` : "";
  return apiFetch<Notificacion[]>(`/comunicaciones/notificaciones${qs}`);
}
export function enviarNotificacion(
  payload: EnviarNotificacionPayload,
): Promise<Notificacion> {
  return apiFetch<Notificacion>(`/comunicaciones/notificaciones/enviar`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}
export function listPlantillas(): Promise<Plantilla[]> {
  return apiFetch<Plantilla[]>(`/comunicaciones/notificaciones/plantillas`);
}
// Alta de plantilla — endpoint del dominio único (RBAC: notificaciones.config; el BE es la autoridad).
export function crearPlantilla(payload: CreatePlantillaPayload): Promise<Plantilla> {
  return apiFetch<Plantilla>(`/comunicaciones/notificaciones/plantillas`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

// SSE de la campana (via fetch stream; EventSource no puede mandar Authorization).
// onEvent se llama por cada frame → el consumidor refetchea. Abortar para desconectar.
export async function subscribeAlertas(opts: {
  centroId?: string | null;
  onEvent: () => void;
  onOpen?: () => void;
  signal: AbortSignal;
}): Promise<void> {
  const supabase = createClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();

  const headers: Record<string, string> = { Accept: "text/event-stream" };
  if (session?.access_token) headers["Authorization"] = `Bearer ${session.access_token}`;
  if (typeof opts.centroId === "string" && opts.centroId) headers["X-Tenant-ID"] = opts.centroId;

  const res = await fetch(`${env.API_BASE_URL}/api/v1/comunicaciones/alertas/stream`, {
    headers,
    signal: opts.signal,
  });
  if (!res.ok || !res.body) {
    // Error con status para que el consumidor decida: 401/403 = no reintentar (sin permiso/sesión);
    // otros = reconectar con backoff. Evita el bucle de reconexión cada 3s (36k UNAUTHORIZED en la
    // bitácora). Ver components/comunicaciones/alertas-bell.tsx.
    const err = new Error(`stream ${res.status}`) as Error & { status?: number };
    err.status = res.status;
    throw err;
  }
  opts.onOpen?.();

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buf = "";
  for (;;) {
    const { value, done } = await reader.read();
    if (done) break;
    buf += decoder.decode(value, { stream: true });
    let sep: number;
    while ((sep = buf.indexOf("\n\n")) >= 0) {
      const frame = buf.slice(0, sep);
      buf = buf.slice(sep + 2);
      // Reunir las líneas `data:` del frame. Filtrar por `entidad === 'alerta'` para no refetchear
      // ante CUALQUIER evento del centro (el stream emite todo): ruido, no rotura. Si el payload no
      // trae `entidad` o no parsea, refetcheamos igual (mejor de más que perder una alerta).
      const dataStr = frame
        .split("\n")
        .filter((l) => l.startsWith("data:"))
        .map((l) => l.slice(5).trim())
        .join("\n");
      if (!dataStr) continue;
      let entidad: unknown;
      try {
        entidad = (JSON.parse(dataStr) as { entidad?: unknown }).entidad;
      } catch {
        entidad = undefined;
      }
      if (entidad === undefined || entidad === "alerta") opts.onEvent();
    }
  }
}
