"use client";

import * as React from "react";

import { abrirCuadreTotal, contarCuadreTotal } from "@/lib/api/caja";
import { latestOnlyQueue } from "@/lib/caja/latest-only-queue";

export type AutosaveState = "idle" | "saving" | "saved" | "error";

type Payload = { fecha: string; counts: Record<string, number> };

// Mismo patrón que use-cash-count-autosave.ts, para el conteo ÚNICO del cuadre total del día: abre
// (o retoma) el día y guarda el conteo ~800ms después del último cambio. Payload más simple que el
// de una división (solo `fecha`, sin userId/pettyCash): el conteo único no tiene cajero ni fondo
// propios, es la cifra que reemplaza la suma de los dos consolidados.
export function useCuadreTotalAutosave(
  enabled: boolean,
  fecha: string,
  counts: Record<string, number>,
  onSaved?: () => void,
  debounceMs = 800,
): { state: AutosaveState; flush: () => Promise<void> } {
  const [state, setState] = React.useState<AutosaveState>("idle");
  const [savedCount, setSavedCount] = React.useState(0);
  const key = JSON.stringify([fecha, counts]);
  const latest = React.useRef<{ key: string; payload: Payload }>({ key, payload: { fecha, counts } });
  const lastQueued = React.useRef(key);
  const timer = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const onSavedRef = React.useRef(onSaved);
  const queue = React.useMemo(
    () =>
      latestOnlyQueue<Payload>(
        async ({ fecha: f, counts: c }) => {
          const cuadre = await abrirCuadreTotal(f);
          // Mismas claves que useCashCountAutosave (`denominationId`/`quantity`, en inglés): el DTO
          // del BE es el mismo (`ConteoLineaDto`) que ya traduce api-ingles en /api/v2.
          const lines = Object.entries(c)
            .filter(([, q]) => q > 0)
            .map(([denominationId, quantity]) => ({ denominationId, quantity }));
          await contarCuadreTotal(cuadre.id, lines);
        },
        (s) => {
          setState(s);
          if (s === "saved") setSavedCount((n) => n + 1);
        },
      ),
    [],
  );

  React.useEffect(() => {
    latest.current = { key, payload: { fecha, counts } };
    onSavedRef.current = onSaved;
  });

  React.useEffect(() => {
    if (savedCount > 0) onSavedRef.current?.();
  }, [savedCount]);

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
