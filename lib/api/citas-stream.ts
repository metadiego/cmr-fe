import { createClient } from "@/lib/supabase/client";
import { env } from "@/lib/env";

// Declarative realtime event from the SSE bus. The FE applies each event
// silently (never re-emits). `channel` = clinic scope; `action` = what changed;
// `status` = the new snapshot; `actorId` = who did it (anti-loop); `version` =
// monotonic ordering token. Las claves llegan en inglés por la capa api-ingles
// (/api/v2). `ts` NO está en el mapa → el BE lo sirve tal cual.
export interface CitaStreamEvent {
  channel: string;
  entity: string; // "cita" | "sesion" | ...
  boardSlug?: string; // originating board (optional)
  id: string;
  action: string; // "estado" | "creada" | "reagendada" | ...
  status?: {
    status: string;
    date: string;
    time: string | null;
    isFirstVisit: boolean;
    doctorId: string | null;
    vitalsNurseId: string | null;
  };
  actorId: string | null;
  version: number;
  ts: string;
}

// Opens the SSE stream via fetch (EventSource can't send Authorization) and
// invokes onEvent per parsed event. Resolves when the stream ends or aborts.
// centroId: string → force that tenant; null/undefined → omit X-Tenant-ID
// (combined scope). Pass a fresh AbortSignal; abort to disconnect.
export async function subscribeCitas(opts: {
  centroId?: string | null;
  onEvent: (e: CitaStreamEvent) => void;
  onOpen?: () => void; // called once the stream is connected
  onId?: (id: string) => void; // last event id, for resume
  lastEventId?: string;
  signal: AbortSignal;
}): Promise<void> {
  const supabase = createClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();

  const headers: Record<string, string> = { Accept: "text/event-stream" };
  if (session?.access_token) headers["Authorization"] = `Bearer ${session.access_token}`;
  if (typeof opts.centroId === "string" && opts.centroId) headers["X-Tenant-ID"] = opts.centroId;
  if (opts.lastEventId) headers["Last-Event-ID"] = opts.lastEventId;

  // Canonical single bus for all verticals (filter by entity on the client).
  // El SSE `tablero/stream` NO tiene alias en inglés en el BE (@Sse('tablero/stream')
  // sin `board/stream`), así que la ruta se mantiene `tablero/stream`; solo cambia el
  // prefijo de versión v1→v2 para que la capa api-ingles traduzca las claves del evento.
  const res = await fetch(`${env.API_BASE_URL}/api/v2/tablero/stream`, {
    headers,
    signal: opts.signal,
  });
  if (!res.ok || !res.body) {
    // Error con status para que el consumidor decida: 401/403 = no reintentar (sin sesión/permiso);
    // otros = reconectar con backoff. Sin esto el bucle reintenta indefinidamente y llena la bitácora
    // con UNAUTHORIZED (mismo patrón que components/comunicaciones/comunicaciones.ts + alertas-bell).
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
    // SSE frames are separated by a blank line.
    while ((sep = buf.indexOf("\n\n")) >= 0) {
      const frame = buf.slice(0, sep);
      buf = buf.slice(sep + 2);
      let data = "";
      for (const line of frame.split("\n")) {
        if (line.startsWith("data:")) data += line.slice(5).trim();
        else if (line.startsWith("id:")) opts.onId?.(line.slice(3).trim());
      }
      if (data) {
        try {
          opts.onEvent(JSON.parse(data) as CitaStreamEvent);
        } catch {
          /* ignore malformed frame */
        }
      }
    }
  }
}
