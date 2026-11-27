"use client";

import { useFormatter, useTranslations } from "next-intl";
import { toast } from "sonner";

import { useBookingResult } from "@/components/appointments-booking/booking-result-provider";
import { appointmentResult } from "@/lib/agenda/appointment-result";
import { resultCenter, resultPatient } from "@/lib/agenda/booking/booking-result";
import { getCita, type Cita, type TipoCita } from "@/lib/api/citas";
import type { Centro } from "@/lib/api/centers";
import type { Paciente } from "@/lib/api/pacientes";
import type { Personal } from "@/lib/api/personal";
import type { ApiWarning } from "@/lib/api/types";
import { warningText } from "@/lib/frontdesk/avisos";

/**
 * Shows the booking success dialog for a medical appointment CitaModal just created (spec §1, every
 * screen). When the BE moved the patient's live appointment instead (`rescheduledFromId`), the old one
 * is read for its date and time; if that read fails it still says "moved", without the old date.
 * Never rejects: if the dialog cannot be built, a plain "appointment created" toast says it was saved.
 */
export function useShowAppointmentResult() {
  const tRoot = useTranslations();
  const t = useTranslations("agenda.modal");
  const format = useFormatter();
  const { show } = useBookingResult();
  return async (
    saved: Cita | undefined,
    warnings: ApiWarning[] | undefined,
    form: {
      patient: Paciente;
      /** The form's date and time, for a save that returned no appointment. */
      asked: { date: string; time: string };
      /** The form's type name; the SAVED type (looked up in `types`) wins (the BE may flip it). */
      typeName: string;
      types: TipoCita[];
      doctor: Personal | undefined;
      center: Centro | undefined;
    },
  ) => {
    try {
      const fromId = saved?.rescheduledFromId;
      const prev = fromId ? await getCita(fromId).catch(() => null) : null;
      const doctor = form.doctor ? [form.doctor.name, form.doctor.lastName].filter(Boolean).join(" ") : "";
      show(
        appointmentResult({
          saved: { date: saved?.date ? String(saved.date) : form.asked.date, time: saved?.time ?? form.asked.time },
          moved: !!fromId,
          from: prev?.date ? { date: String(prev.date), time: prev.time } : null,
          typeName: form.typeName,
          savedTypeId: saved?.appointmentTypeId,
          types: form.types,
          doctor: doctor || saved?.doctorName || null,
          patient: resultPatient(form.patient),
          center: resultCenter(form.center),
          warnings: (warnings ?? []).map((w) => warningText(w, tRoot, format)),
        }),
      );
    } catch {
      toast.success(t("created"));
    }
  };
}
