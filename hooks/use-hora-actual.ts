"use client";

import * as React from "react";

import { BUSINESS_TIME_ZONE } from "@/i18n/formats";

function horaHHMM(d: Date): string {
  return new Intl.DateTimeFormat("es-PR", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone: BUSINESS_TIME_ZONE,
  }).format(d);
}

// Clinic-local ("America/Puerto_Rico") "HH:MM", refreshed every 30s — for highlights that must
// move on their own as the clock advances (e.g. the day agenda's "current franja"), pinned to the
// clinic's timezone rather than the viewer's, matching celda-toggle-hora.tsx / frontdesk-board.tsx.
// See lib/agenda/franja-actual.ts for the pure decision of which franja counts as "now".
export function useHoraActual(): string {
  const [hora, setHora] = React.useState(() => horaHHMM(new Date()));
  React.useEffect(() => {
    const id = setInterval(() => setHora(horaHHMM(new Date())), 30_000);
    return () => clearInterval(id);
  }, []);
  return hora;
}
