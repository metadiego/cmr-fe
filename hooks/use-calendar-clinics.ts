"use client";

import * as React from "react";

import { getCentrosDondePuedo, type Centro } from "@/lib/api/centers";
import { getActiveCentro } from "@/lib/tenant";
import { pickOneClinic, shortClinicNames } from "@/lib/agenda/calendar-clinics";
import { useClinicFilter } from "@/hooks/use-clinic-filter";
import { useMe } from "@/hooks/use-me";
import { useResource } from "@/hooks/use-resource";

/**
 * A month calendar over every clinic the person can read (`readPermission`), with the clinic filter
 * (`useClinicFilter`: the top bar's Bayamón / Caguas / Ambos). What needs ONE clinic — the day view a click opens, a booking — runs in `one`:
 * the top bar's clinic, else the active one (lib/agenda/calendar-clinics.ts `pickOneClinic`).
 * `canCreate` = `writePermission` held there. `dayQuery` names that clinic in the day view's link.
 */
export function useCalendarClinics(readPermission: string, writePermission: string) {
  const filter = useClinicFilter(readPermission);
  const me = useMe();
  const session = me.kind === "ok" ? (me.me.activeClinicId ?? null) : null;
  const readable = React.useMemo(() => filter.centers.map((c) => c.id), [filter.centers]);
  const one = pickOneClinic({ readable, choice: filter.choice, active: getActiveCentro(), session });

  const writeRes = useResource<Centro[]>(() => getCentrosDondePuedo(writePermission), [writePermission]);
  const canCreate = !!one && writeRes.state.kind === "ok" && writeRes.state.data.some((c) => c.id === one);

  const short = React.useMemo(() => shortClinicNames(filter.centers.map((c) => c.name)), [filter.centers]);
  const shortOf = React.useCallback((name: string | null | undefined) => (name ? (short.get(name) ?? name) : ""), [short]);

  return {
    ...filter,
    /** The clinics the month shows. */
    shownIds: filter.choice ?? readable,
    one,
    oneName: filter.nameOf(one),
    /**
     * The clinic a booking from the month starts in: `one`, except on «Ambos» for someone who reads
     * several clinics — then none, and the booking form asks (docs/specs/selector-de-centros-arriba.md).
     */
    bookIn: filter.viewAll && filter.multiClinic ? undefined : (one ?? undefined),
    canCreate,
    shortOf,
    // Only for someone who reads several clinics; with one, the day view opens as it always did.
    dayQuery: filter.multiClinic && one ? `?centro=${encodeURIComponent(one)}` : "",
  };
}
