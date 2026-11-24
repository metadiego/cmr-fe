"use client";

import * as React from "react";

import { dropPastTimes } from "@/lib/agenda/booking/availability";
import { runLimited } from "@/lib/agenda/booking/day-cache";
import { liveSessionDates, trainDaySlots } from "@/lib/agenda/booking/train-rows";
import { planPatientTrain, type PatientTrain } from "@/lib/api/resources";
import { listSesionesRango } from "@/lib/api/frontdesk";
import { getBookingHolidays } from "@/lib/api/festivos";
import { nowTimePR, todayPR } from "@/lib/format/fecha";
import { useResource } from "@/hooks/use-resource";
import type { SeriesDay } from "@/hooks/use-series-availability";

// What the patient desk's therapy form needs for its rows, the train counterpart of
// useSeriesAvailability: for each row date the BE's plan of the WHOLE train (POST /resources/patient-train,
// 4 at a time) as Citas day slots, the days the patient already has a live session of a ticked therapy,
// and the holidays the rows cross. Changing the patient, center, therapies, areas or order drops every
// plan: each one depends on all of them.

const CONCURRENCY = 4;

export function useTrainSeriesAvailability(p: {
  center: string | undefined;
  patientId: string | undefined;
  serviceIds: string[];
  areas: Record<string, number>;
  keepOrder: boolean;
  /** Row dates; empty = nothing to load. */
  dates: string[];
}): {
  days: Record<string, SeriesDay>;
  /** The raw plan per date (end time, legs order, minutes). */
  trains: Record<string, PatientTrain>;
  existingDates: string[];
  holidays: string[];
  /** Existing sessions and holidays answered (or failed): rows may be judged. */
  ready: boolean;
  failed: boolean;
  /** Asks every plan, the sessions and the holidays again (after a failed load or a refused booking). */
  retry: () => void;
} {
  const { center, patientId, serviceIds, areas, keepOrder, dates } = p;
  const idsKey = [...serviceIds].sort().join(",");
  const areasKey = JSON.stringify(Object.fromEntries(serviceIds.map((id) => [id, areas[id] ?? 1]).sort()));
  const [nonce, setNonce] = React.useState(0);
  const scope =
    center && patientId && idsKey ? `${center}|${patientId}|${idsKey}|${areasKey}|${keepOrder}|${nonce}` : "";
  const datesKey = [...new Set(dates)].sort().join(",");

  const [raw, setRaw] = React.useState<{ scope: string; map: Record<string, PatientTrain | "error"> }>({
    scope: "",
    map: {},
  });
  const scopeRef = React.useRef(scope);
  const asked = React.useRef(new Set<string>());
  React.useEffect(() => {
    if (scopeRef.current !== scope) {
      scopeRef.current = scope;
      asked.current = new Set();
    }
  }, [scope]);

  React.useEffect(() => {
    if (!scope || !datesKey || !center || !patientId) return;
    const requestScope = scope;
    const ids = idsKey.split(",");
    const areaMap = JSON.parse(areasKey) as Record<string, number>;
    const missing = datesKey.split(",").filter((d) => !asked.current.has(`${requestScope}#${d}`));
    if (missing.length === 0) return;
    for (const d of missing) asked.current.add(`${requestScope}#${d}`);
    void runLimited(
      missing.map((date) => async () => {
        let value: PatientTrain | "error";
        try {
          value = await planPatientTrain({ date, serviceIds: ids, areas: areaMap, patientId, keepOrder }, center);
        } catch {
          value = "error";
        }
        if (scopeRef.current !== requestScope) return;
        setRaw((s) => ({ scope: requestScope, map: { ...(s.scope === requestScope ? s.map : {}), [date]: value } }));
      }),
      CONCURRENCY,
    );
  }, [scope, datesKey, center, patientId, idsKey, areasKey, keepOrder]);

  const todayIso = todayPR();
  const nowTime = nowTimePR();
  const { days, trains } = React.useMemo(() => {
    const d: Record<string, SeriesDay> = {};
    const tr: Record<string, PatientTrain> = {};
    if (raw.scope !== scope) return { days: d, trains: tr };
    for (const [date, v] of Object.entries(raw.map)) {
      if (v === "error") d[date] = "error";
      else {
        tr[date] = v;
        // Today's hours already gone are not offered (as in Citas).
        d[date] = dropPastTimes(trainDaySlots(v), todayIso, nowTime);
      }
    }
    return { days: d, trains: tr };
  }, [raw, scope, todayIso, nowTime]);

  const sorted = datesKey ? datesKey.split(",") : [];
  const from = sorted[0];
  const to = sorted[sorted.length - 1];

  const existingRes = useResource<{ serviceId: string; date: string; status: string }[]>(
    () =>
      scope && from && to
        ? listSesionesRango({ desde: from, hasta: to, pacienteId: patientId, centroId: center }).then((list) =>
            list.map((s) => ({ serviceId: s.serviceId, date: String(s.date), status: s.status })),
          )
        : Promise.resolve([]),
    [scope, from, to],
  );

  const years =
    from && to
      ? Array.from({ length: Number(to.slice(0, 4)) - Number(from.slice(0, 4)) + 1 }, (_, i) => Number(from.slice(0, 4)) + i)
      : [];
  const holidaysRes = useResource<string[]>(
    () => (scope && center && years.length ? getBookingHolidays(years, center) : Promise.resolve([])),
    [scope, years.join(",")],
  );

  const existingDates = React.useMemo(
    () => (existingRes.state.kind === "ok" ? liveSessionDates(existingRes.state.data, idsKey.split(",")) : []),
    [existingRes.state, idsKey],
  );
  const holidays = React.useMemo(
    () => (holidaysRes.state.kind === "ok" ? holidaysRes.state.data : []),
    [holidaysRes.state],
  );
  const ready = existingRes.state.kind !== "loading" && holidaysRes.state.kind !== "loading";
  // Without the sessions or the holidays a same-day duplicate or a holiday would go through unseen.
  const failed = existingRes.state.kind === "fail" || holidaysRes.state.kind === "fail";

  const retry = React.useCallback(() => setNonce((n) => n + 1), []);

  return { days, trains, existingDates, holidays, ready, failed, retry };
}
