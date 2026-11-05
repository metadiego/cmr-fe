"use client";

import * as React from "react";

import { getCentrosDondePuedo, type Centro } from "@/lib/api/centers";
import { useResource } from "@/hooks/use-resource";
import { clinicFilterChoice, topBarSelection } from "@/lib/clinic-read-scope";
import { getActiveCentro, isClinicViewAll } from "@/lib/tenant";

/**
 * The clinics a list screen reads (docs/specs/selector-de-centros-arriba.md): the clinics where the person
 * holds `permission`, narrowed by the top bar (Bayamón / Caguas / Ambos). `choice` lists the clinics to
 * read (every readable one on «Ambos»; `null` only while loading) — pass it to the API function, which
 * names them as `centerIds` and sends the first as X-Tenant-ID. There is no filter on the screen any more:
 * the top bar is the filter, and the Centro column always shows.
 * Each row carries its own `clinicId`/`clinicName`: actions on a row use the row's clinic, never a screen's.
 */
export function useClinicFilter(permission: string) {
  const res = useResource<Centro[]>(() => getCentrosDondePuedo(permission), [permission]);
  const centers = React.useMemo(() => (res.state.kind === "ok" ? res.state.data : []), [res.state]);
  const readable = React.useMemo(() => centers.map((c) => c.id), [centers]);
  const active = getActiveCentro();
  const viewAll = isClinicViewAll();
  const selected = topBarSelection(viewAll, active);
  const choice = clinicFilterChoice(readable, selected, active);
  return {
    centers,
    choice,
    /** The top bar is on «Ambos»: a create must ask which clinic. */
    viewAll,
    /** Stable key of `choice`, for a resource's dependency list. */
    choiceKey: choice ? choice.join(",") : "all",
    showColumn: true,
    /** The person reads more than one clinic with this permission. */
    multiClinic: centers.length > 1,
    loading: res.state.kind === "loading",
    nameOf: (id: string | null | undefined) => centers.find((c) => c.id === id)?.name ?? "",
  };
}
