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
  onInvalidate: () => void;
  onEvent?: (e: CitaStreamEvent) => void;
  debounceMs?: number;
}): { live: boolean } {
  const { centroId, enabled = true, debounceMs = 400 } = opts;
  const [live, setLive] = React.useState(false);

  // Keep callbacks current without re-subscribing on every render.
  const cbRef = React.useRef(opts);
  React.useEffect(() => {
    cbRef.current = opts;
  });

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
              cbRef.current.onEvent?.(e);
              scheduleInvalidate();
            },
          });
        } catch {
          if (stopped || controller.signal.aborted) break;
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
