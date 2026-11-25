"use client";

import * as React from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";

import { EditAppointmentModal } from "@/components/appointments-booking/patient-rail";
import { useResource } from "@/hooks/use-resource";
import { getCita, getTiposCita, type Cita, type TipoCita } from "@/lib/api/citas";
import { getPaciente, type Paciente } from "@/lib/api/pacientes";
import type { DayListRow } from "@/lib/api/appointments-day";

// "Change" on a medical row: the booking screen's own edit dialog (EditAppointmentModal → CitaModal, whose
// reschedule action makes the new row), fed the appointment, its patient and the type catalogue. Mounted
// only while open, so a long day does not fetch per row. The row's allowedActions draw its menu.
export function EditMedicalRow({ row, onClose, onSaved }: { row: DayListRow; onClose: () => void; onSaved: () => void }) {
  const t = useTranslations("appointmentsDay");
  const res = useResource<{ cita: Cita; patient: Paciente | null; types: TipoCita[] }>(
    async () => {
      const [cita, patient, types] = await Promise.all([
        getCita(row.id),
        getPaciente(row.patient.id, row.centerId).catch(() => null),
        getTiposCita(),
      ]);
      return { cita, patient, types };
    },
    [row.id],
  );
  const failed = res.state.kind === "fail" ? res.state.message : null;
  React.useEffect(() => {
    if (!failed) return;
    toast.error(t("loadFailed", { message: failed }));
    onClose();
  }, [failed, onClose, t]);

  if (res.state.kind !== "ok") return null;
  const { cita, patient, types } = res.state.data;
  return (
    <EditAppointmentModal
      cita={cita}
      patient={patient}
      center={row.centerId}
      appointmentTypes={types}
      allowedActions={row.allowedActions}
      onClose={onClose}
      onSaved={() => {
        onSaved();
        onClose();
      }}
    />
  );
}
