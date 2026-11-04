"use client";

import * as React from "react";

import { useResource } from "@/hooks/use-resource";
import { listCitas, type Cita } from "@/lib/api/citas";
import { listSesionesRango } from "@/lib/api/frontdesk";
import { inDaysPR, todayPR } from "@/lib/format/fecha";
import {
  fromCita,
  fromSesion,
  splitUpcomingPast,
  type PatientAppointment,
} from "@/lib/agenda/booking/patient-appointments";

// The patient rail's list: the selected patient's medical appointments and service sessions from
// today−90 to today+365, merged and split into Upcoming / Past (lib/agenda/booking/patient-appointments).
//
// - Medical: GET /appointments?patientId&from&to with NO centerIds and no tenant override: without
//   centerIds the BE lists every center where the user holds citas.read (cmr-be
//   citas.clinic-scope.integration.spec.ts, "without centerIds: every center the user can read"), which
//   is exactly the set we want; `listCitas` has no centerIds parameter anyway.
// - Service: GET /frontdesk/sesiones?patientId&from&to in the screen's center (X-Tenant-ID): the BE
//   scopes sessions to the active center.
// One side failing does not hide the other: each is loaded on its own and `failed` names the kinds that
// failed. `reload()` refetches silently (the list stays on screen while it runs).

export interface PatientAppointments {
  upcoming: PatientAppointment[];
  past: PatientAppointment[];
  loading: boolean;
  failed: ("medical" | "service")[];
  /** The raw medical appointment behind a rail item, for CitaModal's edit mode. */
  citaOf: (id: string) => Cita | undefined;
  reload: () => void;
}

interface Loaded {
  citas: Cita[] | null; // null = failed
  items: PatientAppointment[];
  serviceFailed: boolean;
}

const EMPTY: Loaded = { citas: [], items: [], serviceFailed: false };

export function usePatientAppointments(
  patientId: string | undefined,
  center: string | undefined,
): PatientAppointments {
  const res = useResource<Loaded>(async () => {
    if (!patientId) return EMPTY;
    const from = inDaysPR(-90);
    const to = inDaysPR(365);
    const [medical, service] = await Promise.allSettled([
      listCitas({ patientId, from, to, limit: 100 }),
      center
        ? listSesionesRango({ desde: from, hasta: to, pacienteId: patientId, centroId: center })
        : Promise.resolve([]),
    ]);
    const citas = medical.status === "fulfilled" ? medical.value.items : null;
    const sesiones = service.status === "fulfilled" ? service.value : [];
    return {
      citas,
      items: [...(citas ?? []).map(fromCita), ...sesiones.map(fromSesion)],
      serviceFailed: service.status === "rejected",
    };
  }, [patientId, center]);

  const data = res.state.kind === "ok" ? res.state.data : EMPTY;
  const today = todayPR();
  const { upcoming, past } = React.useMemo(() => splitUpcomingPast(data.items, today), [data.items, today]);

  const failed: ("medical" | "service")[] = [];
  if (res.state.kind === "fail" || data.citas === null) failed.push("medical");
  if (res.state.kind === "fail" || data.serviceFailed) failed.push("service");

  return {
    upcoming,
    past,
    loading: !!patientId && res.state.kind === "loading",
    failed,
    citaOf: (id) => data.citas?.find((c) => c.id === id),
    reload: res.refresh,
  };
}
