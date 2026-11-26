"use client";

import * as React from "react";

import { dropPastTimes } from "@/lib/agenda/booking/availability";
import { runLimited } from "@/lib/agenda/booking/day-cache";
import { sameDaySessions, trainDaySlots, trainRequest } from "@/lib/agenda/booking/train-rows";
import { planPatientTrain, type PatientTrain } from "@/lib/api/resources";
import { listSesionesRango } from "@/lib/api/frontdesk";
import { getBookingHolidays } from "@/lib/api/festivos";
import { nowTimePR, todayPR } from "@/lib/format/fecha";
import { useResource } from "@/hooks/use-resource";
import { sessionStageFields, type SessionStageFields } from "@/lib/lifecycle/stage-groups";
import type { SeriesDay } from "@/hooks/use-series-availability";

// What the patient desk's therapy form needs for its rows, the train counterpart of
// useSeriesAvailability: for each row date the BE's plan of THAT DAY's train (POST
// /resources/patient-train, 4 at a time; a therapy can be taken off one date) as Citas day slots, the
// days the patient already has a live session of one of that day's therapies, and the holidays the
// rows cross. A plan is cached per date and per request (therapies, areas, order): taking a therapy
// off one date asks that date again and nothing else.

const CONCURRENCY = 4;

/** An existing session, with its stage fields so `sameDaySessions` reads its stage group. */
export type ExistingSession = SessionStageFields & { serviceId: string; date: string; time: string | null; status: string };

export function useTrainSeriesAvailability(p: {
  center: string | undefined;
  patientId: string | undefined;
  /** Each row's date and its therapies (tick order); empty = nothing to load. */
  rows: { date: string; serviceIds: string[] }[];
  areas: Record<string, number>;
  keepOrder: boolean;
}): {
  days: Record<string, SeriesDay>;
  /** The raw plan per date (end time, legs order, minutes). */
  trains: Record<string, PatientTrain>;
  existingDates: string[];
  /** The patient's sessions in the rows' range (any therapy, any status): what a blocked row names. */
  sessions: ExistingSession[];
  holidays: string[];
  /** Existing sessions and holidays answered (or failed): rows may be judged. */
  ready: boolean;
  failed: boolean;
  /** Asks every plan, the sessions and the holidays again (after a failed load or a refused booking). */
  retry: () => void;
} {
  const { center, patientId, rows, areas, keepOrder } = p;
  // Each date asked in tick order (what «Mantener mi orden» keeps), keyed on what changes its plan.
  const asks = rows
    .filter((r) => r.serviceIds.length)
    .map((r) => ({ date: r.date, ...trainRequest(r.serviceIds, areas, keepOrder) }));
  const asksRef = React.useRef(asks);
  React.useEffect(() => {
    asksRef.current = asks;
  });
  const [nonce, setNonce] = React.useState(0);
  const scope = center && patientId && asks.length ? `${center}|${patientId}|${nonce}` : "";
  const asksKey = asks.map((a) => `${a.date}#${a.key}`).sort().join(";");

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
    if (!scope || !asksKey || !center || !patientId) return;
    const requestScope = scope;
    const missing = asksRef.current.filter((a) => !asked.current.has(`${a.date}#${a.key}`));
    if (missing.length === 0) return;
    for (const a of missing) asked.current.add(`${a.date}#${a.key}`);
    void runLimited(
      missing.map((a) => async () => {
        let value: PatientTrain | "error";
        try {
          value = await planPatientTrain(
            { date: a.date, serviceIds: a.serviceIds, areas: a.areas, patientId, keepOrder },
            center,
          );
        } catch {
          value = "error";
        }
        if (scopeRef.current !== requestScope) return;
        const k = `${a.date}#${a.key}`;
        setRaw((s) => ({ scope: requestScope, map: { ...(s.scope === requestScope ? s.map : {}), [k]: value } }));
      }),
      CONCURRENCY,
    );
  }, [scope, asksKey, center, patientId, keepOrder]);

  const todayIso = todayPR();
  const nowTime = nowTimePR();
  const { days, trains } = React.useMemo(() => {
    const d: Record<string, SeriesDay> = {};
    const tr: Record<string, PatientTrain> = {};
    if (raw.scope !== scope) return { days: d, trains: tr };
    for (const a of asks) {
      const date = a.date;
      const v = raw.map[`${date}#${a.key}`];
      if (v === undefined) continue;
      if (v === "error") d[date] = "error";
      else {
        tr[date] = v;
        // Today's hours already gone are not offered (as in Citas).
        d[date] = dropPastTimes(trainDaySlots(v), todayIso, nowTime);
      }
    }
    return { days: d, trains: tr };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- asksKey covers asks
  }, [raw, scope, asksKey, todayIso, nowTime]);

  const sorted = [...new Set(asks.map((a) => a.date))].sort();
  const from = sorted[0];
  const to = sorted[sorted.length - 1];

  const existingRes = useResource<ExistingSession[]>(
    () =>
      scope && from && to
        ? listSesionesRango({ desde: from, hasta: to, pacienteId: patientId, centroId: center }).then((list) =>
            list.map((s) => ({
              serviceId: s.serviceId,
              date: String(s.date),
              time: s.time ?? null,
              status: s.status,
              ...sessionStageFields(s),
            })),
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

  const sessions = React.useMemo(
    () => (existingRes.state.kind === "ok" ? existingRes.state.data : []),
    [existingRes.state],
  );
  // A date is taken when the patient already has one of THAT day's therapies (live) that day.
  const existingDates = React.useMemo(
    () => asks.filter((a) => sameDaySessions(sessions, a.date, a.serviceIds).length > 0).map((a) => a.date),
    // eslint-disable-next-line react-hooks/exhaustive-deps -- asksKey covers asks
    [sessions, asksKey],
  );
  const holidays = React.useMemo(
    () => (holidaysRes.state.kind === "ok" ? holidaysRes.state.data : []),
    [holidaysRes.state],
  );
  const ready = existingRes.state.kind !== "loading" && holidaysRes.state.kind !== "loading";
  // Without the sessions or the holidays a same-day duplicate or a holiday would go through unseen.
  const failed = existingRes.state.kind === "fail" || holidaysRes.state.kind === "fail";

  const retry = React.useCallback(() => setNonce((n) => n + 1), []);

  return { days, trains, existingDates, sessions, holidays, ready, failed, retry };
}
