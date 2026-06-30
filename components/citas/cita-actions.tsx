"use client";

import * as React from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { HugeiconsIcon } from "@hugeicons/react";
import { MoreHorizontalIcon } from "@hugeicons/core-free-icons";

import {
  confirmarCita,
  presenteCita,
  noShowCita,
  cancelarCita,
  reagendarCita,
  type Cita,
  type EstadoCita,
} from "@/lib/api/citas";
import { toastError } from "@/lib/api/errors";
import { useCan } from "@/hooks/use-can";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

// Scheduling-flow actions allowed from each state (slice 2). Clinical states
// (triage/en_consulta → vitals/consult) are handled in slice 3.
const ACTIONS: Record<EstadoCita, string[]> = {
  programada: ["confirmar", "reagendar", "noShow", "cancelar"],
  confirmada: ["presente", "reagendar", "noShow", "cancelar"],
  presente: ["cancelar"],
  triage: ["cancelar"],
  en_consulta: ["cancelar"],
  atendida: [],
  no_show: [],
  cancelada: [],
  reprogramada: [],
};

export function CitaActions({
  cita,
  onChanged,
}: {
  cita: Cita;
  onChanged: () => void;
}) {
  const t = useTranslations("appointments.actions");
  const tc = useTranslations("common");
  const tRoot = useTranslations();
  const { can } = useCan();
  const centroId = cita.clinicId ?? undefined;

  const [busy, setBusy] = React.useState(false);
  const [cancelOpen, setCancelOpen] = React.useState(false);
  const [reagOpen, setReagOpen] = React.useState(false);
  const [noShowOpen, setNoShowOpen] = React.useState(false);
  const [motivo, setMotivo] = React.useState("");
  const [reFecha, setReFecha] = React.useState(cita.fecha);
  const [reHora, setReHora] = React.useState(cita.hora ?? "");

  const actions = ACTIONS[cita.estado] ?? [];
  if (actions.length === 0 || !can("citas.update")) return null;

  async function run(fn: () => Promise<unknown>, after?: () => void) {
    setBusy(true);
    try {
      await fn();
      toast.success(t("done"));
      after?.();
      onChanged();
    } catch (err) {
      toastError(err, tRoot);
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon" disabled={busy} aria-label={t("menu")}>
            <HugeiconsIcon icon={MoreHorizontalIcon} className="size-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          {actions.includes("confirmar") && (
            <DropdownMenuItem onSelect={() => run(() => confirmarCita(cita.id, centroId))}>
              {t("confirmar")}
            </DropdownMenuItem>
          )}
          {actions.includes("presente") && (
            <DropdownMenuItem onSelect={() => run(() => presenteCita(cita.id, centroId))}>
              {t("presente")}
            </DropdownMenuItem>
          )}
          {actions.includes("reagendar") && (
            <DropdownMenuItem onSelect={() => setReagOpen(true)}>
              {t("reagendar")}
            </DropdownMenuItem>
          )}
          {actions.includes("noShow") && (
            <DropdownMenuItem onSelect={() => setNoShowOpen(true)}>
              {t("noShow")}
            </DropdownMenuItem>
          )}
          {actions.includes("cancelar") && (
            <DropdownMenuItem
              variant="destructive"
              onSelect={() => setCancelOpen(true)}
            >
              {t("cancelar")}
            </DropdownMenuItem>
          )}
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Cancel — requires a reason */}
      <Dialog open={cancelOpen} onOpenChange={setCancelOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("cancelTitle")}</DialogTitle>
            <DialogDescription>{t("cancelHelp")}</DialogDescription>
          </DialogHeader>
          <div className="space-y-1.5">
            <Label>{t("reason")}</Label>
            <Textarea value={motivo} onChange={(e) => setMotivo(e.target.value)} rows={3} />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCancelOpen(false)} disabled={busy}>
              {tc("cancel")}
            </Button>
            <Button
              variant="destructive"
              disabled={busy || !motivo.trim()}
              onClick={() =>
                run(
                  () => cancelarCita(cita.id, motivo.trim(), centroId),
                  () => {
                    setCancelOpen(false);
                    setMotivo("");
                  },
                )
              }
            >
              {t("cancelar")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Reschedule — new date/time + reason */}
      <Dialog open={reagOpen} onOpenChange={setReagOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("reagendarTitle")}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>{t("date")}</Label>
                <Input type="date" value={reFecha} onChange={(e) => setReFecha(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label>{t("time")}</Label>
                <Input type="time" value={reHora} onChange={(e) => setReHora(e.target.value)} />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>{t("reason")}</Label>
              <Textarea value={motivo} onChange={(e) => setMotivo(e.target.value)} rows={2} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setReagOpen(false)} disabled={busy}>
              {tc("cancel")}
            </Button>
            <Button
              disabled={busy || !reFecha || !motivo.trim()}
              onClick={() =>
                run(
                  () =>
                    reagendarCita(
                      cita.id,
                      { fecha: reFecha, hora: reHora || undefined, motivo: motivo.trim() },
                      centroId,
                    ),
                  () => {
                    setReagOpen(false);
                    setMotivo("");
                  },
                )
              }
            >
              {t("reagendar")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* No-show — confirm */}
      <AlertDialog open={noShowOpen} onOpenChange={setNoShowOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("noShowTitle")}</AlertDialogTitle>
            <AlertDialogDescription>{t("noShowHelp")}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={busy}>{tc("cancel")}</AlertDialogCancel>
            <AlertDialogAction
              disabled={busy}
              onClick={(e) => {
                e.preventDefault();
                run(() => noShowCita(cita.id, centroId), () => setNoShowOpen(false));
              }}
            >
              {t("noShow")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
