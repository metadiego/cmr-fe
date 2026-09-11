"use client";

import * as React from "react";

import { initialAgendaCenter } from "@/lib/agenda/initial-center";
import { getActiveCentro } from "@/lib/tenant";

const CENTER_KEY = "cmr_agenda_centro";

/**
 * Which center the day view is showing, and how it is remembered.
 *
 * It used to be `useState(ALL)` for everyone, but the combined scope is admin/master only: the
 * backend answers 409 to a non-admin request with no `X-Tenant-ID`, and every realtime stream is
 * now scoped to the active center. The rest of the staff landed on a value they could not use.
 *
 * The answer is DERIVED (never written from an effect): an explicit pick wins, otherwise
 * `initialAgendaCenter` decides once `me` and the assigned centers have landed. `null` means "not
 * resolved yet" — the caller waits instead of asking the API for a scope it has no right to.
 * See docs/specs/be-sse-acotado-al-centro-handoff.md.
 */
export function useAgendaCenter(opts: {
  centerIds: string[];
  /** Both `me` and the assigned centers have landed. */
  ready: boolean;
  canSeeAllCenters: boolean;
}): { center: string | null; pick: (id: string) => void } {
  const { centerIds, ready, canSeeAllCenters } = opts;
  const [saved] = React.useState<string | null>(() =>
    typeof window === "undefined" ? null : window.localStorage.getItem(CENTER_KEY),
  );
  const [chosen, setChosen] = React.useState<string | null>(null);

  // Serialized so the memo key stays stable across the array identity the caller rebuilds.
  const key = centerIds.join(",");
  const resolved = React.useMemo(
    () =>
      ready
        ? initialAgendaCenter({
            canSeeAllCenters,
            saved,
            activeCenter: getActiveCentro(),
            centers: key ? key.split(",") : [],
          })
        : null,
    [ready, canSeeAllCenters, saved, key],
  );

  const pick = React.useCallback((id: string) => {
    setChosen(id);
    if (typeof window !== "undefined") window.localStorage.setItem(CENTER_KEY, id);
  }, []);

  return { center: chosen ?? resolved, pick };
}
