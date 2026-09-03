"use client";

import * as React from "react";

import { subscribeCitas, type CitaStreamEvent } from "@/lib/api/citas-stream";

// Subscribes to the citas SSE stream for a scope and calls onInvalidate
// (debounced) whenever something changes — so every open window refreshes live.
// Reconnects with backoff and resumes via Last-Event-ID. Returns { live }.
//   centroId: string → that clinic; null → combined (all permitted).
export function useCitaStream(opts: {
  centroId?: string | null;
  enabled?: boolean;
  entidad?: string; // only react to events of this entity (cita|sesion|…)
  onInvalidate: () => void;
  onEvent?: (e: CitaStreamEvent) => void;
  debounceMs?: number;
  pollMs?: number; // safety-net refetch interval while NOT live (SSE down)
}): { live: boolean } {
  const { centroId, enabled = true, debounceMs = 400, pollMs = 20000 } = opts;
  const [live, setLive] = React.useState(false);

  // Keep callbacks current without re-subscribing on every render.
  const cbRef = React.useRef(opts);
  React.useEffect(() => {
    cbRef.current = opts;
  });
  const liveRef = React.useRef(live);
  React.useEffect(() => {
    liveRef.current = live;
  }, [live]);

  // Self-heal: refetch when the tab regains focus or the network comes back
  // (a crashed/slept connection may have missed events). And while the SSE is
  // down, poll as a safety net so the board never sits silently stale.
  React.useEffect(() => {
    if (!enabled) return;
    const onVisible = () => {
      if (document.visibilityState === "visible") cbRef.current.onInvalidate();
    };
    const onOnline = () => cbRef.current.onInvalidate();
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("online", onOnline);
    const poll = setInterval(() => {
      if (!liveRef.current) cbRef.current.onInvalidate();
    }, pollMs);
    return () => {
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("online", onOnline);
      clearInterval(poll);
    };
  }, [enabled, pollMs]);

  React.useEffect(() => {
    if (!enabled) return;
    const controller = new AbortController();
    let stopped = false;
    let lastId: string | undefined;
    let debounceT: ReturnType<typeof setTimeout> | null = null;
    let backoff = 1000;

    const scheduleInvalidate = () => {
      if (debounceT) clearTimeout(debounceT);
      debounceT = setTimeout(() => cbRef.current.onInvalidate(), debounceMs);
    };

    const run = async () => {
      while (!stopped) {
        try {
          await subscribeCitas({
            centroId,
            lastEventId: lastId,
            signal: controller.signal,
            onOpen: () => {
              backoff = 1000;
              setLive(true);
            },
            onId: (id) => {
              lastId = id;
            },
            onEvent: (e) => {
              // Single bus for all verticals → ignore events of other entities.
              if (cbRef.current.entidad && e.entity !== cbRef.current.entidad) return;
              cbRef.current.onEvent?.(e);
              scheduleInvalidate();
            },
          });
        } catch (err) {
          if (stopped || controller.signal.aborted) break;
          // 401/403 = sin sesión/permiso: PARAR (no reintentar). Antes reconectaba indefinidamente
          // → ~4 UNAUTHORIZED/min por pestaña contra /tablero/stream (mismo bug que la campana).
          const status = (err as { status?: number } | null)?.status;
          if (status === 401 || status === 403) {
            setLive(false);
            break;
          }
        }
        setLive(false);
        if (stopped) break;
        await new Promise((r) => setTimeout(r, backoff));
        backoff = Math.min(backoff * 2, 15000);
      }
    };
    void run();

    return () => {
      stopped = true;
      controller.abort();
      if (debounceT) clearTimeout(debounceT);
      setLive(false);
    };
  }, [centroId, enabled, debounceMs]);

  return { live };
}
