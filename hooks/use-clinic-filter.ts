"use client";

import * as React from "react";

import { getCentrosDondePuedo, type Centro } from "@/lib/api/centers";
import { useResource } from "@/hooks/use-resource";
import { clinicFilterChoice, showsClinicColumn } from "@/lib/clinic-read-scope";
import { getActiveCentro } from "@/lib/tenant";

/**
 * "All my clinics + a filter" for a list screen (handoff clinic-read-scope): the clinics where the person
 * holds `permission`, what the filter ticked, and what a read should ask for. `choice` lists the clinics
 * to read (every readable one when nothing is ticked; `null` only while loading) — pass it to the API
 * function, which names them as `centerIds` and sends the first as X-Tenant-ID.
 * Each row carries its own `clinicId`/`clinicName`: actions on a row use the row's clinic, never a screen's.
 */
export function useClinicFilter(permission: string) {
  const res = useResource<Centro[]>(() => getCentrosDondePuedo(permission), [permission]);
  const centers = React.useMemo(() => (res.state.kind === "ok" ? res.state.data : []), [res.state]);
  const readable = React.useMemo(() => centers.map((c) => c.id), [centers]);
  const [selected, setSelected] = React.useState<string[] | null>(null);
  const choice = clinicFilterChoice(readable, selected, getActiveCentro());
  return {
    centers,
    selected,
    setSelected,
    choice,
    /** Stable key of `choice`, for a resource's dependency list. */
    choiceKey: choice ? choice.join(",") : "all",
    showFilter: centers.length > 1,
    showColumn: showsClinicColumn(readable),
    loading: res.state.kind === "loading",
    nameOf: (id: string | null | undefined) => centers.find((c) => c.id === id)?.name ?? "",
  };
}
