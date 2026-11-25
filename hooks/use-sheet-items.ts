"use client";

import * as React from "react";

import { fromCita, fromSesion } from "@/lib/agenda/booking/patient-appointments";
import type { BookingResult, BookingResultItem } from "@/lib/agenda/booking/booking-result";
import { sheetItems } from "@/lib/agenda/booking/sheet-items";
import { getTiposCita, listCitasEveryCenter } from "@/lib/api/citas";
import { listSesionesRango } from "@/lib/api/frontdesk";
import { getServicios } from "@/lib/api/servicios";

// The rows of the printed appointment sheet: what was booked plus the patient's other appointments on
// those days (lib/agenda/booking/sheet-items.ts). The read starts when the booking dialog opens, so
// «Imprimir» rarely waits. Every read that fails counts as empty: the sheet then prints what was booked,
// never less.

async function loadSheetItems(result: BookingResult): Promise<BookingResultItem[]> {
  const patientId = result.patient.id;
  if (!patientId || result.items.length === 0) return result.items;
  const dates = result.items.map((i) => i.date).sort();
  const from = dates[0];
  const to = dates[dates.length - 1];
  const [citas, sesiones, types, services] = await Promise.all([
    listCitasEveryCenter({ patientId, from, to, limit: 100 }).then((r) => r.items).catch(() => []),
    listSesionesRango({ desde: from, hasta: to, pacienteId: patientId }).catch(() => []),
    getTiposCita().catch(() => []),
    getServicios(result.center.id).catch(() => []),
  ]);
  const typeNames = new Map(types.map((x) => [x.id, x.name]));
  const serviceNames = new Map(services.map((x) => [x.id, x.name]));
  return sheetItems(result, [...citas.map(fromCita), ...sesiones.map(fromSesion)], (kind, id) =>
    (kind === "medical" ? typeNames : serviceNames).get(id),
  );
}

/** A promise of the sheet's rows, started once per result. */
export function useSheetItems(result: BookingResult): () => Promise<BookingResultItem[]> {
  const pending = React.useRef<{ result: BookingResult; items: Promise<BookingResultItem[]> } | null>(null);
  React.useEffect(() => {
    if (pending.current?.result !== result) pending.current = { result, items: loadSheetItems(result) };
  }, [result]);
  return () => {
    if (pending.current?.result !== result) pending.current = { result, items: loadSheetItems(result) };
    return pending.current.items.catch(() => result.items);
  };
}
