"use client";

import * as React from "react";

import { getEstados, type EstadoCitaCatalogo } from "@/lib/api/citas";
import { useResource } from "@/hooks/use-resource";

const EMPTY: EstadoCitaCatalogo[] = [];

// Shared state catalog (GET /appointments/statuses). getEstados() memoizes the promise,
// so multiple callers share a single fetch. Returns the list + a slug→estado map.
export function useEstados(): {
  estados: EstadoCitaCatalogo[];
  map: Map<string, EstadoCitaCatalogo>;
  ready: boolean;
} {
  const { state } = useResource<EstadoCitaCatalogo[]>(() => getEstados());
  const estados = state.kind === "ok" ? state.data : EMPTY;
  const map = React.useMemo(() => {
    const list = state.kind === "ok" ? state.data : EMPTY;
    return new Map(list.map((e) => [e.slug, e]));
  }, [state]);
  return { estados, map, ready: state.kind === "ok" };
}
