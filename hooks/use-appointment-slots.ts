"use client";

import * as React from "react";

import { getCuposLibres, type CuposLibres } from "@/lib/api/citas";
import { cappedBySheet } from "@/lib/agenda/sheet";
import type { Slot } from "@/components/agenda/slot-picker";
import { useResource } from "@/hooks/use-resource";

/**
 * The appointment type's free places on one day at one clinic (available-slots endpoint), shaped for the
 * appointment dialog (components/agenda/cita-modal.tsx): whole-hour bands with free/capacity, the type's
 * duration (it rules over the catalogue's for the end time), the day's holiday and the call-center sheet.
 * Never blocking: with no clinic, day or type yet it loads nothing. Handoff citas-hora-por-cupo-handoff-be.
 */
export function useAppointmentSlots(clinicId: string, date: string, typeId: string) {
  const res = useResource<CuposLibres | null>(
    () => (clinicId && date && typeId ? getCuposLibres(date, typeId, clinicId) : Promise.resolve(null)),
    [clinicId, date, typeId],
  );
  const data = res.state.kind === "ok" ? res.state.data : null;
  const slots: Slot[] = React.useMemo(() => {
    // The BE has sent the list as `slots` or `franjas`; never `.map` over undefined (it used to crash the dialog).
    const arr = data?.slots ?? data?.franjas ?? [];
    return arr.map((s) => ({ time: s.time, vacios: s.free, cupo: s.capacity, enHoja: cappedBySheet(s) }));
  }, [data]);
  return {
    slots,
    /** The day's hours have answered (or failed): an empty list then means the type has none. */
    loaded: res.state.kind !== "loading",
    duration: data?.durationMinutes ?? null,
    // The picked day's holiday (BE handoff booking-availability-fixes §D): explains an empty picker
    // (`closedByHoliday`); the informative kind (not blocking) is shown too.
    holiday: data?.holidays?.[0] ?? null,
    sheet: data?.sheet ?? null,
  };
}
