"use client";

import * as React from "react";
import { useTranslations } from "next-intl";

import { getTiposCita, type TipoCita } from "@/lib/api/citas";
import { getMedicos, type Personal } from "@/lib/api/personal";
import { getPaciente, type Paciente } from "@/lib/api/pacientes";
import { toastError } from "@/lib/api/errors";
import { nowTimePR, todayPR } from "@/lib/format/fecha";
import { nextFullHour } from "@/lib/agenda/appointment-form";
import { useResource } from "@/hooks/use-resource";
import { CitaModal } from "@/components/agenda/cita-modal";

/**
 * «Agregar cita» from a board (patient desk, generic boards): the same CitaModal as Citas, so it ends in
 * the booking success dialog like every other booking (spec 2026-11-23 §6). The board's walk-in defaults:
 * today, the next whole hour (editable), status «confirmada» so it lands on today's board, and the
 * patient preloaded when the board already has one. The BE keeps one live appointment per patient
 * (a different day moves it; the success dialog says «Cita movida»).
 */
export function BoardAppointmentModal({
  centroId,
  lockedPatient,
  onClose,
  onSaved,
  onFilterPatient,
}: {
  centroId?: string;
  // The patient the board already has (e.g. «Citar» on the patient desk header).
  lockedPatient?: { id: string; nombre: string };
  onClose: () => void;
  onSaved?: () => void;
  // The EHR-data form was closed without completing it: the board stays filtered on that patient so
  // reception can finish them without searching again.
  onFilterPatient?: (p: { id: string; nombre: string }) => void;
}) {
  const tRoot = useTranslations();
  const tiposRes = useResource<TipoCita[]>(() => getTiposCita());
  const medicosRes = useResource<Personal[]>(() => getMedicos(centroId), [centroId]);
  // The dialog reads its patient once, when it mounts: it waits for the locked one to load. A failed
  // load is shown and the form opens without a patient, to be picked by hand.
  const pacienteRes = useResource<Paciente | null>(
    () =>
      lockedPatient
        ? getPaciente(lockedPatient.id, centroId).catch((err) => {
            toastError(err, tRoot);
            return null;
          })
        : Promise.resolve(null),
    [lockedPatient?.id, centroId],
  );
  // Computed once per open, so a re-render never moves the hour the dialog started with.
  const [{ fecha, hora }] = React.useState(() => ({ fecha: todayPR(), hora: nextFullHour(nowTimePR()) }));

  if (pacienteRes.state.kind === "loading") return null;
  const paciente = pacienteRes.state.kind === "ok" ? pacienteRes.state.data : null;

  return (
    <CitaModal
      open
      fecha={fecha}
      horaInicial={hora}
      pacienteInicial={paciente}
      centroId={centroId}
      tipos={tiposRes.state.kind === "ok" ? tiposRes.state.data : []}
      medicos={medicosRes.state.kind === "ok" ? medicosRes.state.data : []}
      canal="frontdesk"
      estadoInicial="confirmada"
      onOpenChange={(o) => !o && onClose()}
      onSaved={() => onSaved?.()}
      onPatientDataClosed={(p) => {
        onFilterPatient?.({
          id: p.id,
          nombre: p.displayName || [p.firstName, p.lastName].filter(Boolean).join(" ") || lockedPatient?.nombre || p.id,
        });
        onClose();
      }}
    />
  );
}
