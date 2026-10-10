"use client";

import * as React from "react";

import {
  getFrontdeskTablero as getServiceBoard,
  getFrontdeskTabs,
  listSesionesRango as listSessions,
  type FrontdeskTab,
  type FrontdeskTablero as ServiceBoard,
  type Sesion as Session,
} from "@/lib/api/frontdesk";
import { getServicios as getServices, type Servicio as Service } from "@/lib/api/servicios";
import { getDefinicion as getBoardDefinition, getFilas as getBoardRows, type Tablero as BoardRows, type TableroDefinicion as BoardDefinition } from "@/lib/api/tablero";
import { groupByPatient, type DayService, type PatientDay } from "@/lib/frontdesk/patient-day";
import { useResource } from "@/hooks/use-resource";
import { useCitaStream as useLiveStream } from "@/hooks/use-cita-stream";

export interface PatientDayData {
  patients: PatientDay[];
  sessionsById: Map<string, Session>;
  boardsBySlug: Record<string, ServiceBoard>;
  servicesById: Map<string, Service>;
  serviceDefinition: BoardDefinition | null;
  consultations: BoardRows | null;
  consultationDefinition: BoardDefinition | null;
  consultationTab: FrontdeskTab | null;
  loading: boolean;
  error: string | null;
  live: boolean;
  refresh: () => void;
}

// Everything the patient desk shows for one center and day: the day's sessions across ALL services
// (one call), the board of each service that has any (columns + projected rows, only those), the
// consultation board, and the definitions that drive the flow. Live: any frontdesk or consultation
// event refetches (same single SSE bus as the frontdesk), with the hook's focus/poll safety nets.
export function usePatientDay(centerId: string | undefined, date: string): PatientDayData {
  const tabsRes = useResource<FrontdeskTab[]>(() => (centerId ? getFrontdeskTabs(centerId).catch(() => []) : Promise.resolve([])), [centerId]);
  const servicesRes = useResource<Service[]>(() => (centerId ? getServices(centerId) : Promise.resolve([])), [centerId]);
  const serviceDefRes = useResource<BoardDefinition | null>(() => (centerId ? getBoardDefinition("servicios", centerId) : Promise.resolve(null)), [centerId]);
  const consultDefRes = useResource<BoardDefinition | null>(
    () => (centerId ? getBoardDefinition("atencion", centerId).catch(() => null) : Promise.resolve(null)),
    [centerId],
  );
  const sessionsRes = useResource<Session[]>(
    () => (centerId ? listSessions({ desde: date, hasta: date, centroId: centerId }) : Promise.resolve([])),
    [centerId, date],
  );
  const consultRes = useResource<BoardRows | null>(
    () => (centerId ? getBoardRows("atencion", date, { centroId: centerId }).catch(() => null) : Promise.resolve(null)),
    [centerId, date],
  );

  const tabs = React.useMemo(() => (tabsRes.state.kind === "ok" ? tabsRes.state.data : []), [tabsRes.state]);
  const sessions = React.useMemo(() => (sessionsRes.state.kind === "ok" ? sessionsRes.state.data : []), [sessionsRes.state]);
  const servicesById = React.useMemo(
    () => new Map((servicesRes.state.kind === "ok" ? servicesRes.state.data : []).map((s) => [s.id, s])),
    [servicesRes.state],
  );

  // The day's services, in the frontdesk tab order, with their tab color.
  const dayServices = React.useMemo<DayService[]>(() => {
    const out: DayService[] = [];
    for (const tab of tabs) {
      if (tab.boardSlug !== "servicios" || !tab.serviceId) continue;
      const s = servicesById.get(tab.serviceId);
      out.push({ id: tab.serviceId, slug: tab.slug, name: s?.name ?? tab.name, color: tab.color ?? null });
    }
    return out;
  }, [tabs, servicesById]);

  // Boards only for the services someone has today.
  const slugsKey = React.useMemo(() => {
    const ids = new Set(sessions.map((s) => s.serviceId));
    return dayServices.filter((s) => ids.has(s.id)).map((s) => s.slug).join(",");
  }, [sessions, dayServices]);
  const boardsRes = useResource<Record<string, ServiceBoard>>(
    () =>
      centerId && slugsKey
        ? Promise.all(
            slugsKey.split(",").map((slug) =>
              getServiceBoard(slug, date, centerId)
                .then((b) => [slug, b] as const)
                .catch(() => [slug, { columns: [], rows: [] } as ServiceBoard] as const),
            ),
          ).then((pairs) => Object.fromEntries(pairs))
        : Promise.resolve({}),
    [centerId, date, slugsKey],
  );

  const consultations = consultRes.state.kind === "ok" ? consultRes.state.data : null;
  const patients = React.useMemo(
    () =>
      groupByPatient(
        sessions.map((s) => ({ ...s, patientId: String(s.patientId), serviceId: String(s.serviceId) })),
        (consultations?.rows ?? []) as { id: string }[],
        dayServices,
      ),
    [sessions, consultations, dayServices],
  );
  const sessionsById = React.useMemo(() => new Map(sessions.map((s) => [s.id, s])), [sessions]);

  const refresh = React.useCallback(() => {
    sessionsRes.refresh();
    consultRes.refresh();
    boardsRes.refresh();
  }, [sessionsRes, consultRes, boardsRes]);

  const { live } = useLiveStream({ centroId: centerId ?? null, enabled: !!centerId, onInvalidate: refresh });

  const fail = [sessionsRes, servicesRes, serviceDefRes].map((r) => r.state).find((s) => s.kind === "fail");
  return {
    patients,
    sessionsById,
    boardsBySlug: boardsRes.state.kind === "ok" ? boardsRes.state.data : {},
    servicesById,
    serviceDefinition: serviceDefRes.state.kind === "ok" ? serviceDefRes.state.data : null,
    consultations,
    consultationDefinition: consultDefRes.state.kind === "ok" ? consultDefRes.state.data : null,
    consultationTab: tabs.find((t) => t.boardSlug === "atencion") ?? null,
    loading: sessionsRes.state.kind === "loading" || tabsRes.state.kind === "loading" || servicesRes.state.kind === "loading",
    error: fail && fail.kind === "fail" ? fail.message : null,
    live,
    refresh,
  };
}
