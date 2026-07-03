import { createClient } from "@/lib/supabase/client";
import { env } from "@/lib/env";

// Declarative realtime event from GET /citas/stream (SSE). The FE applies each
// event silently (never re-emits). `canal` = clinic scope; `accion` = what
// changed; `estado` = the new snapshot; `actorId` = who did it (anti-loop);
// `version` = monotonic ordering token.
export interface CitaStreamEvent {
  canal: string;
  entidad: string; // "cita"
  id: string;
  accion: string; // "estado" | "creada" | "reagendada" | ...
  estado?: {
    estado: string;
    fecha: string;
    hora: string | null;
    esPrimeraVez: boolean;
    medicoId: string | null;
    enfermeraVitalesId: string | null;
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

  const res = await fetch(`${env.API_BASE_URL}/api/v1/citas/stream`, {
    headers,
    signal: opts.signal,
  });
  if (!res.ok || !res.body) throw new Error(`stream ${res.status}`);
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
