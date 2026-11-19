"use client";

import * as React from "react";
import { useTranslations } from "next-intl";

import { usePatientDay, useServiceBoards } from "@/hooks/use-patient-day";
import { ServiceSessionsTable } from "@/components/patient-desk/service-sessions-table";
import { EhrGateHost } from "@/components/tablero/ehr-readiness-modal";
import type { EhrGateCtx } from "@/components/tablero/flujo-atencion";
import type { Servicio } from "@/lib/api/servicios";
import { TherapyDayScheduler } from "@/components/agenda/therapy-day-scheduler";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";

// Visor general de UNA terapia, TODOS sus pacientes del día (pedido del dueño, 17-nov-2026, a partir
// de la pantalla del legado; corregido 18-nov-2026, cmr-fe #139: la referencia es PATIENT-DESK, no el
// frontdesk viejo deprecado). Clic en el NOMBRE de una pastilla de la cola (therapy-queue-strip.tsx,
// sin paciente — centro+fecha) abre esto. Renderiza el MISMO ServiceSessionsTable que patient-desk
// (components/patient-desk/patient-detail.tsx), alimentado por los MISMOS hooks (usePatientDay +
// useServiceBoards): cero plomería propia, cero FilaSesion propio, cero literal en ningún prop. Así
// Asistir, compras, ACCIONES, el candado de datos EHR y la alerta de saldo no pueden divergir entre
// patient-desk y este visor — gobierna patient-desk, el visor solo recorta a UN servicio y un Dialog.
export function ServiceBoardViewer({
  servicio,
  centro,
  fecha,
  open,
  onOpenChange,
}: {
  servicio: Servicio;
  centro: string | undefined;
  fecha: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const tRoot = useTranslations();
  const [programar, setProgramar] = React.useState<{ open: boolean; pacienteId?: string; pacienteNombre?: string; servicioId?: string }>({ open: false });
  // Mismo motivo que patient-detail.tsx (§ serviceEhrGate ahí): vive en el Dialog, no en una fila, porque
  // la fila puede desmontarse a mitad de la acción al refrescar y el Dialog sigue montado.
  const [serviceEhrGate, setServiceEhrGate] = React.useState<EhrGateCtx | null>(null);

  const data = usePatientDay(open ? centro : undefined, fecha);
  const boardsBySlug = useServiceBoards(open ? centro : undefined, fecha, open ? [servicio.slug] : [], data.refreshTick);
  const board = boardsBySlug[servicio.slug];
  const sessionIds = React.useMemo(() => (board?.rows ?? []).map((r) => r.id), [board]);

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-6xl">
          <DialogHeader>
            <DialogTitle>{servicio.name}</DialogTitle>
          </DialogHeader>

          <ServiceSessionsTable
            slug={servicio.slug}
            name={servicio.name}
            color={servicio.color}
            service={data.servicesById.get(servicio.id)}
            board={board}
            definition={data.serviceDefinition}
            sessionsById={data.sessionsById}
            sessionIds={sessionIds}
            date={fecha}
            centerId={centro}
            onChanged={data.refresh}
            onSchedule={(ctx) => setProgramar({ open: true, ...ctx, servicioId: ctx.servicioId ?? servicio.id })}
            onEhrGate={setServiceEhrGate}
          />
        </DialogContent>
      </Dialog>

      <Dialog open={programar.open} onOpenChange={(o) => setProgramar((p) => ({ ...p, open: o }))}>
        <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-5xl">
          <DialogHeader>
            <DialogTitle>{tRoot("programarCitas.title")}</DialogTitle>
            <DialogDescription className="sr-only">{servicio.name}</DialogDescription>
          </DialogHeader>
          <TherapyDayScheduler
            defaultDate={fecha}
            defaultServiceId={servicio.id}
            centro={centro}
            lockedPatient={programar.pacienteId ? { id: programar.pacienteId, name: programar.pacienteNombre ?? "" } : undefined}
            onBooked={({ close }) => {
              data.refresh();
              if (close) setProgramar((p) => ({ ...p, open: false }));
            }}
          />
        </DialogContent>
      </Dialog>

      <EhrGateHost gate={serviceEhrGate} centroId={centro} onClose={() => setServiceEhrGate(null)} />
    </>
  );
}
