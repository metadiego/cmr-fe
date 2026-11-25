"use client";

import * as React from "react";
import { useTranslations } from "next-intl";

import { useAppointmentLabel } from "@/components/appointments-booking/patient-rail";
import type { PatientAppointments } from "@/hooks/use-patient-appointments";
import type { PatientAppointment } from "@/lib/agenda/booking/patient-appointments";
import { cn } from "@/lib/utils";

// «Ya agendadas» in the patient desk's therapy form: the patient's upcoming appointments (therapies and
// medical, the Citas rail's own list via usePatientAppointments), read-only, so a new visit is not put on
// top of one already booked. Those on a date the form is booking are highlighted.

export function PatientBookedList({
  data,
  nameOf,
  visitDates,
}: {
  data: Pick<PatientAppointments, "upcoming" | "loading" | "failed">;
  nameOf: (a: PatientAppointment) => string;
  /** The dates the form is booking: their appointments are marked. */
  visitDates: ReadonlySet<string>;
}) {
  const t = useTranslations("therapyBooking");
  const tPatient = useTranslations("appointmentsBooking.patient");
  const tRoot = useTranslations();
  const label = useAppointmentLabel();

  return (
    <section className="flex flex-col gap-2" aria-label={t("bookedTitle")}>
      <h3 className="text-xs font-semibold tracking-wider text-muted-foreground uppercase">
        {t("bookedTitle")}
        {data.upcoming.length > 0 && <span className="tabular-nums"> · {data.upcoming.length}</span>}
      </h3>
      {data.failed.map((k) => (
        <p key={k} className="text-xs text-destructive">
          {tPatient(k === "medical" ? "loadFailedMedical" : "loadFailedService")}
        </p>
      ))}
      {data.upcoming.length > 0 ? (
        <ul className="max-h-44 overflow-y-auto rounded-lg border text-xs tabular-nums">
          {data.upcoming.map((a) => {
            const clash = visitDates.has(a.date.slice(0, 10));
            const statusKey = `${a.kind === "medical" ? "citas.estado" : "servicios.estado"}.${a.status}`;
            return (
              <li
                key={a.id}
                className={cn(
                  "grid grid-cols-[minmax(0,7.5rem)_minmax(0,1fr)_auto] items-center gap-x-3 border-b px-3 py-1.5 last:border-b-0",
                  clash && "bg-warning/40 text-warning-foreground",
                )}
              >
                <span className="truncate font-medium first-letter:uppercase">{label(a.date, a.time)}</span>
                <span className="truncate">{nameOf(a)}</span>
                <span className={cn("shrink-0", !clash && "text-muted-foreground")}>
                  {clash ? t("sameDateAsVisit") : tRoot.has(statusKey) ? tRoot(statusKey) : a.status}
                </span>
              </li>
            );
          })}
        </ul>
      ) : (
        <p className="text-xs text-muted-foreground">{data.loading ? tRoot("common.loading") : tPatient("noUpcoming")}</p>
      )}
    </section>
  );
}
