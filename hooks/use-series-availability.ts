"use client";

import * as React from "react";

import { dropPastTimes, fromServiceAvailability, normalizeTime, type DaySlots } from "@/lib/agenda/booking/availability";
import { runLimited } from "@/lib/agenda/booking/day-cache";
import { existingRange, suggestionExclusions } from "@/lib/agenda/booking/series-booking";
import { buildRecurringPlan, weekdayOf, type AvailabilityLookup } from "@/lib/agenda/recurring-plan";
import { getAvailability, type Availability } from "@/lib/api/resources";
import { listSesionesRango } from "@/lib/api/frontdesk";
import { getBookingHolidays } from "@/lib/api/festivos";
import { nowTimePR, todayPR } from "@/lib/format/fecha";
import { useResource } from "@/hooks/use-resource";

// Everything a weekly series of one service needs for one patient: each row date's real availability
// (areas 1, patient-aware, 4 requests at a time), the patient's existing sessions of the service, the
// holidays the series crosses and, for each row that is not free, the planner's suggestion
// (buildRecurringPlan for that one date: closest fitting time that day, else the next week that fits).

const CONCURRENCY = 4;
const SUGGESTION_CONCURRENCY = 2;

export type SeriesDay = DaySlots | null | "error";
export type Suggestion = { date: string; time: string } | null;

export interface SeriesNeed {
  index: number;
  date: string;
  time: string;
}

export function suggestionKey(n: SeriesNeed, exclusions: string[]): string {
  return `${n.date}|${normalizeTime(n.time)}|${exclusions.join(",")}`;
}

export function useSeriesAvailability(p: {
  center: string | undefined;
  serviceId: string;
  patientId: string | undefined;
  /** Row dates; empty = nothing to load (no series, or no patient yet). */
  dates: string[];
}): {
  days: Record<string, SeriesDay>;
  existingDates: string[];
  /** Dates in `existingDates` whose only session of the service is cancelled. */
  cancelledDates: string[];
  holidays: string[];
  /** Existing sessions and holidays answered (or failed): rows may be judged. */
  ready: boolean;
  failed: boolean;
  retry: () => void;
  /** Suggestions per `suggestionKey`; computed for the needs passed to `wantSuggestions`. */
  suggestions: Record<string, Suggestion>;
  wantSuggestions: (needs: SeriesNeed[]) => void;
} {
  const { center, serviceId, patientId, dates } = p;
  const scope = center && patientId ? `${center}|${serviceId}|${patientId}` : "";
  const datesKey = [...dates].sort().join(",");

  // ---- Day availability (raw answers kept for the planner's lookup).
  const [raw, setRaw] = React.useState<{ scope: string; map: Record<string, Availability | "error"> }>({
    scope: "",
    map: {},
  });
  const scopeRef = React.useRef(scope);
  const rawRef = React.useRef<Record<string, Availability | "error">>({});
  const inflight = React.useRef(new Map<string, Promise<Availability>>());
  React.useEffect(() => {
    if (scopeRef.current !== scope) {
      scopeRef.current = scope;
      rawRef.current = {};
      inflight.current = new Map();
    }
  }, [scope]);

  const fetchRaw = React.useCallback(
    (date: string): Promise<Availability> => {
      const hit = rawRef.current[date];
      if (hit && hit !== "error") return Promise.resolve(hit);
      const running = inflight.current.get(date);
      if (running) return running;
      const requestScope = scope;
      const req = getAvailability({ date, serviceId, areas: 1, ...(patientId ? { patientId } : {}) }, center); // center as X-Tenant-ID only — see use-booking-availability.ts (single centerIds → 400)
      inflight.current.set(date, req);
      const store = (value: Availability | "error") => {
        inflight.current.delete(date);
        if (scopeRef.current !== requestScope) return;
        rawRef.current = { ...rawRef.current, [date]: value };
        setRaw((s) => ({ scope: requestScope, map: { ...(s.scope === requestScope ? s.map : {}), [date]: value } }));
      };
      req.then(store, () => store("error"));
      return req;
    },
    [center, serviceId, patientId, scope],
  );

  const [nonce, setNonce] = React.useState(0);
  React.useEffect(() => {
    if (!scope || !datesKey) return;
    const missing = datesKey.split(",").filter((d) => {
      const hit = rawRef.current[d];
      return hit === undefined || hit === "error";
    });
    if (missing.length === 0) return;
    void runLimited(missing.map((d) => () => fetchRaw(d)), CONCURRENCY);
  }, [scope, datesKey, fetchRaw, nonce]);

  const todayIso = todayPR();
  const nowTime = nowTimePR();
  const days = React.useMemo(() => {
    const out: Record<string, SeriesDay> = {};
    if (raw.scope !== scope) return out;
    for (const [d, v] of Object.entries(raw.map)) {
      if (v === "error") out[d] = "error";
      else {
        const slots = fromServiceAvailability(d, v);
        out[d] = slots ? dropPastTimes(slots, todayIso, nowTime) : null;
      }
    }
    return out;
  }, [raw, scope, todayIso, nowTime]);

  // ---- The patient's existing sessions of this service over the rows (+ the forward search).
  const range = existingRange(dates);
  const existingRes = useResource<{ date: string; cancelled: boolean }[]>(
    () =>
      scope && range
        ? listSesionesRango({
            desde: range.from,
            hasta: range.to,
            servicioId: serviceId,
            pacienteId: patientId,
            centroId: center,
          }).then((list) =>
            // Every status counts: the BE skips a date the patient has ANY session of the service on.
            list
              .filter((s) => !s.serviceId || s.serviceId === serviceId)
              .map((s) => ({ date: String(s.date).slice(0, 10), cancelled: s.status === "cancelada" })),
          )
        : Promise.resolve([]),
    [scope, range?.from, range?.to, nonce],
  );

  // ---- Holidays of every year the range crosses.
  const years = range
    ? Array.from(
        { length: Number(range.to.slice(0, 4)) - Number(range.from.slice(0, 4)) + 1 },
        (_, i) => Number(range.from.slice(0, 4)) + i,
      )
    : [];
  const holidaysRes = useResource<string[]>(
    () =>
      scope && center && years.length
        ? getBookingHolidays(years, center)
        : Promise.resolve([]),
    [scope, years.join(","), nonce],
  );

  const existingDates = React.useMemo(
    () => (existingRes.state.kind === "ok" ? [...new Set(existingRes.state.data.map((e) => e.date))] : []),
    [existingRes.state],
  );
  const cancelledDates = React.useMemo(() => {
    if (existingRes.state.kind !== "ok") return [];
    const live = new Set(existingRes.state.data.filter((e) => !e.cancelled).map((e) => e.date));
    return existingDates.filter((d) => !live.has(d));
  }, [existingRes.state, existingDates]);
  const holidays = React.useMemo(
    () => (holidaysRes.state.kind === "ok" ? holidaysRes.state.data : []),
    [holidaysRes.state],
  );
  const ready = existingRes.state.kind !== "loading" && holidaysRes.state.kind !== "loading";
  // A failed existing-sessions or holidays read would let a duplicate / a holiday through unseen: the
  // form must not book on either.
  const failed = existingRes.state.kind === "fail" || holidaysRes.state.kind === "fail";

  // ---- Suggestions: one single-date plan per row that is not free.
  const [suggestions, setSuggestions] = React.useState<{ scope: string; map: Record<string, Suggestion> }>({
    scope: "",
    map: {},
  });
  const asked = React.useRef(new Set<string>());
  const latest = React.useRef({ existingDates, holidays, dates, scope });
  React.useEffect(() => {
    latest.current = { existingDates, holidays, dates, scope };
  });

  const wantSuggestions = React.useCallback(
    (needs: SeriesNeed[]) => {
      const { existingDates: ex, holidays: hol, dates: rowDates, scope: s } = latest.current;
      if (!s) return;
      const lookup: AvailabilityLookup = async (date) => {
        const a = await fetchRaw(date);
        return { configured: a.configured, slots: a.slots.map((x) => ({ ...x, time: normalizeTime(x.time) })) };
      };
      const tasks = needs
        .map((n) => ({ n, excl: suggestionExclusions(rowDates, n.index, ex, hol) }))
        .map(({ n, excl }) => ({ n, excl, key: `${s}#${suggestionKey(n, excl)}` }))
        .filter(({ key }) => !asked.current.has(key));
      if (tasks.length === 0) return;
      for (const t of tasks) asked.current.add(t.key);
      const today = todayPR();
      void runLimited(
        tasks.map(({ n, excl }) => async () => {
          let out: Suggestion = null;
          try {
            const [item] = await buildRecurringPlan(
              {
                serviceId,
                centro: center,
                areas: 1,
                startDate: n.date,
                weekdays: [weekdayOf(n.date)],
                preferredTime: normalizeTime(n.time),
                count: 1,
                existingDates: excl,
                minTimeOnStartDate: n.date === today ? nowTimePR() : undefined,
              },
              lookup,
            );
            if (item && (item.status === "adjustedTime" || item.status === "adjustedDate")) {
              out = { date: item.date, time: normalizeTime(item.time) };
            }
          } catch {
            out = null;
          }
          const key = suggestionKey(n, excl);
          setSuggestions((st) => ({ scope: s, map: { ...(st.scope === s ? st.map : {}), [key]: out } }));
        }),
        SUGGESTION_CONCURRENCY,
      );
    },
    [center, serviceId, fetchRaw],
  );

  const retry = React.useCallback(() => {
    asked.current = new Set();
    setNonce((n) => n + 1);
  }, []);

  return {
    days,
    existingDates,
    cancelledDates,
    holidays,
    ready,
    failed,
    retry,
    suggestions: suggestions.scope === scope ? suggestions.map : {},
    wantSuggestions,
  };
}
