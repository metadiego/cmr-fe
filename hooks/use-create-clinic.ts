"use client";

import * as React from "react";

import { getCentrosDondePuedo, type Centro } from "@/lib/api/centers";
import { createClinicOf } from "@/lib/create-clinic";
import { getActiveCentro } from "@/lib/tenant";
import { useMe } from "@/hooks/use-me";
import { useResource } from "@/hooks/use-resource";

/**
 * Where a list screen that reads every clinic creates a new record (lib/create-clinic.ts): the clinics
 * where the person holds `permission` and the default one for the filter's `choice`. The create UI shows
 * it (`CreateClinicField`) and lets the person switch among `centers` before saving.
 */
export function useCreateClinic(permission: string, choice: readonly string[] | null) {
  const me = useMe();
  const res = useResource<Centro[]>(() => getCentrosDondePuedo(permission), [permission]);
  const centers = React.useMemo(() => (res.state.kind === "ok" ? res.state.data : []), [res.state]);
  const sessionCenterId = me.kind === "ok" ? (me.me.activeClinicId ?? null) : null;
  return {
    centers,
    /** "" while loading or when the person cannot create anywhere. */
    defaultClinicId: createClinicOf(choice, centers.map((c) => c.id), getActiveCentro(), sessionCenterId),
    canCreate: centers.length > 0,
    loading: res.state.kind === "loading",
  };
}
