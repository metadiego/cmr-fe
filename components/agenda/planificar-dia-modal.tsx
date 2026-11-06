"use client";

import { useTranslations } from "next-intl";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { TherapyDayScheduler } from "@/components/agenda/therapy-day-scheduler";
import { CreateClinicGate } from "@/components/kit/create-clinic-gate";
import type { Paciente } from "@/lib/api/pacientes";

// «Planificar el día» desde el calendario de Citas de servicio: al pulsar una fecha (o un paciente) se abre
// el MISMO scheduler que la ruta aparte —con los huecos reales— en vez de la vieja alta a ciegas. Centraliza:
// no hay que salir del calendario ni abrir otra página.
export function PlanificarDiaModal({
  open,
  fecha,
  paciente,
  centro,
  centroNombre,
  onOpenChange,
  onSaved,
}: {
  open: boolean;
  fecha: string;
  paciente?: Paciente | null;
  centro?: string;
  /** The clinic it books in, shown in the title when the person reads several. */
  centroNombre?: string;
  onOpenChange: (open: boolean) => void;
  onSaved: () => void;
}) {
  const t = useTranslations("therapyPlanner");
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-5xl">
        <DialogHeader>
          <DialogTitle>{centroNombre ? `${t("title")} · ${centroNombre}` : t("title")}</DialogTitle>
        </DialogHeader>
        {/* Opened without a clinic on «Ambos» (the month calendar): it asks first. */}
        <CreateClinicGate permission="frontdesk.create" clinicId={centro}>
          {(clinicId) => (
            <TherapyDayScheduler
              defaultDate={fecha}
              defaultPatient={paciente}
              centro={clinicId}
              onBooked={({ close }) => {
                onSaved();
                if (close) onOpenChange(false);
              }}
            />
          )}
        </CreateClinicGate>
      </DialogContent>
    </Dialog>
  );
}
