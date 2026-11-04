"use client";

import * as React from "react";

import { abrirCuadre, contarCuadre, type AbrirCuadrePayload } from "@/lib/api/caja";
import { latestOnlyQueue } from "@/lib/caja/latest-only-queue";

export type AutosaveState = "idle" | "saving" | "saved" | "error";

type Payload = { open: AbrirCuadrePayload; counts: Record<string, number> };

// Saves the cash count (and the opening fund / «aplica») while the cashier types, ~800 ms after the
// last change, so a reload no longer loses it (owner, 04-nov-2026). Opening is idempotent in the BE
// (returns the day's open count for that division/cashier) and counting replaces the whole count, so
// each save is open + count; the queue keeps one save in flight. Only while `enabled` (a concrete
// cashier, not closed). `flush()` saves anything pending and waits — call it before closing.
export function useCashCountAutosave(
  enabled: boolean,
  open: AbrirCuadrePayload,
  counts: Record<string, number>,
  debounceMs = 800,
): { state: AutosaveState; flush: () => Promise<void> } {
  const [state, setState] = React.useState<AutosaveState>("idle");
  const key = JSON.stringify([open, counts]);
  const latest = React.useRef<{ key: string; payload: Payload }>({ key, payload: { open, counts } });
  const lastQueued = React.useRef(key); // what is on screen at mount is what the BE already has
  const timer = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const queue = React.useMemo(
    () =>
      latestOnlyQueue<Payload>(
        async ({ open: o, counts: c }) => {
          const cuadre = await abrirCuadre(o);
          const lines = Object.entries(c)
            .filter(([, q]) => q > 0)
            .map(([denominationId, quantity]) => ({ denominationId, quantity }));
          await contarCuadre(cuadre.id, lines);
        },
        (s) => setState(s),
      ),
    [],
  );

  React.useEffect(() => {
    latest.current = { key, payload: { open, counts } };
  });

  React.useEffect(() => {
    if (!enabled || key === lastQueued.current) return;
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      timer.current = null;
      lastQueued.current = latest.current.key;
      queue.push(latest.current.payload);
    }, debounceMs);
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, [enabled, key, debounceMs, queue]);

  const flush = React.useCallback(async () => {
    if (timer.current) {
      clearTimeout(timer.current);
      timer.current = null;
    }
    if (enabled && latest.current.key !== lastQueued.current) {
      lastQueued.current = latest.current.key;
      queue.push(latest.current.payload);
    }
    await queue.idle();
  }, [enabled, queue]);

  return { state, flush };
}
