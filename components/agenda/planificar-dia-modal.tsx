"use client";

import { useTranslations } from "next-intl";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { TherapyDayScheduler } from "@/components/agenda/therapy-day-scheduler";
import type { Paciente } from "@/lib/api/pacientes";

// «Planificar el día» desde el calendario de Citas de servicio: al pulsar una fecha (o un paciente) se abre
// el MISMO scheduler que la ruta aparte —con los huecos reales— en vez de la vieja alta a ciegas. Centraliza:
// no hay que salir del calendario ni abrir otra página.
export function PlanificarDiaModal({
  open,
  fecha,
  paciente,
  centro,
  onOpenChange,
  onSaved,
}: {
  open: boolean;
  fecha: string;
  paciente?: Paciente | null;
  centro?: string;
  onOpenChange: (open: boolean) => void;
  onSaved: () => void;
}) {
  const t = useTranslations("therapyPlanner");
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-5xl">
        <DialogHeader>
          <DialogTitle>{t("title")}</DialogTitle>
        </DialogHeader>
        <TherapyDayScheduler
          defaultDate={fecha}
          defaultPatient={paciente}
          centro={centro}
          onBooked={() => {
            onSaved();
            onOpenChange(false);
          }}
        />
      </DialogContent>
    </Dialog>
  );
}
