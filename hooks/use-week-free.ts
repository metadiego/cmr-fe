"use client";

import { getCuposLibres } from "@/lib/api/citas";
import { dayFree } from "@/lib/agenda/appointment-when";
import { useResource } from "@/hooks/use-resource";

/**
 * Free places of the appointment type on each day of the dialog's week strip (one available-slots call
 * per day, the same endpoint as the picked day's hours). A day that fails or has no hours is null: the
 * strip then shows no count for it. Nothing is loaded without clinic or type.
 */
export function useWeekFree(clinicId: string, dates: string[], typeId: string): Record<string, number | null> {
  const key = dates.join(",");
  const res = useResource<Record<string, number | null>>(
    async () => {
      if (!clinicId || !typeId || dates.length === 0) return {};
      const counts = await Promise.all(
        dates.map((d) =>
          getCuposLibres(d, typeId, clinicId)
            .then((c) => dayFree((c?.slots ?? c?.franjas ?? []).map((s) => ({ time: s.time, vacios: s.free }))))
            .catch(() => null),
        ),
      );
      return Object.fromEntries(dates.map((d, i) => [d, counts[i]]));
    },
    [clinicId, key, typeId],
  );
  return res.state.kind === "ok" ? res.state.data : {};
}
