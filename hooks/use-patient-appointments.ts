"use client";

import * as React from "react";

import { useResource } from "@/hooks/use-resource";
import { listCitas, type Cita } from "@/lib/api/citas";
import { listSesionesRango, type Sesion } from "@/lib/api/frontdesk";
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

const NONE_CITAS: Cita[] = [];
const NONE_SESIONES: Sesion[] = [];

export interface PatientAppointments {
  upcoming: PatientAppointment[];
  past: PatientAppointment[];
  loading: boolean;
  failed: ("medical" | "service")[];
  /** The raw medical appointment behind a rail item, for CitaModal's edit mode. */
  citaOf: (id: string) => Cita | undefined;
  reload: () => void;
}

export function usePatientAppointments(
  patientId: string | undefined,
  center: string | undefined,
): PatientAppointments {
  // Two loads, so switching the screen's center only re-asks the center-scoped sessions; the medical
  // list stays put. (A move does not switch the screen's center: the calendar reads the appointment's
  // own center instead, see calendarCenter.)
  const medicalRes = useResource<Cita[]>(
    async () =>
      patientId ? (await listCitas({ patientId, from: inDaysPR(-90), to: inDaysPR(365), limit: 100 })).items : [],
    [patientId],
  );
  const serviceRes = useResource<Sesion[]>(
    () =>
      patientId && center
        ? listSesionesRango({ desde: inDaysPR(-90), hasta: inDaysPR(365), pacienteId: patientId, centroId: center })
        : Promise.resolve([]),
    [patientId, center],
  );

  const citas = medicalRes.state.kind === "ok" ? medicalRes.state.data : NONE_CITAS;
  const sesiones = serviceRes.state.kind === "ok" ? serviceRes.state.data : NONE_SESIONES;
  const today = todayPR();
  const { upcoming, past } = React.useMemo(
    () => splitUpcomingPast([...citas.map(fromCita), ...sesiones.map(fromSesion)], today),
    [citas, sesiones, today],
  );

  const failed: ("medical" | "service")[] = [];
  if (medicalRes.state.kind === "fail") failed.push("medical");
  if (serviceRes.state.kind === "fail") failed.push("service");

  const refreshMedical = medicalRes.refresh;
  const refreshService = serviceRes.refresh;
  return {
    upcoming,
    past,
    loading: !!patientId && (medicalRes.state.kind === "loading" || serviceRes.state.kind === "loading"),
    failed,
    citaOf: (id) => citas.find((c) => c.id === id),
    reload: () => {
      refreshMedical();
      refreshService();
    },
  };
}
