"use client";

import * as React from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";

import { getOldRecordSuggestion, replaceRecord, type OldRecordSuggestion } from "@/lib/api/pacientes";
import { toastError } from "@/lib/api/errors";
import { useResource } from "@/hooks/use-resource";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";

// Aviso de "récord nuevo por inactividad" (docs/specs/record-nuevo-por-inactividad.md del BE):
// "inactivo" es que la última visita realmente ATENDIDA/ASISTIDA tiene N+ años — nunca "nunca
// marcado Presente". El cuadrito de editar el récord (CeldaEditable en Atención) YA EXISTE; esto
// solo añade la SUGERENCIA y usa el endpoint especial que guarda el récord viejo en el historial.
// Handoff HANDOFF-record-nuevo-por-inactividad.md.
export function OldRecordSuggestionBanner({
  patientId,
  centroId,
  recordActual,
  onReemplazado,
}: {
  patientId: string;
  centroId?: string;
  recordActual: string | null;
  onReemplazado: () => void;
}) {
  const t = useTranslations("patients.oldRecord");
  const tc = useTranslations("common");
  const tRoot = useTranslations();
  const { state, reload } = useResource<OldRecordSuggestion>(
    () => getOldRecordSuggestion(patientId, centroId),
    [patientId, centroId],
  );
  const [open, setOpen] = React.useState(false);
  const [valor, setValor] = React.useState("");
  const [busy, setBusy] = React.useState(false);

  const sugerencia = state.kind === "ok" ? state.data : null;
  if (!sugerencia?.suggested) return null;

  function abrir() {
    setValor(sugerencia?.suggestedRecord ?? "");
    setOpen(true);
  }

  async function confirmar() {
    setBusy(true);
    try {
      await replaceRecord(patientId, valor.trim() || undefined, centroId);
      toast.success(t("guardado"));
      setOpen(false);
      onReemplazado();
      reload();
    } catch (err) {
      toastError(err, tRoot);
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-warning/40 bg-warning/10 px-4 py-3 text-sm">
        <span>{t("aviso", { years: sugerencia.yearsInactive ?? 0 })}</span>
        <Button size="sm" onClick={abrir}>{t("asignar")}</Button>
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>{t("dialogoTitulo")}</DialogTitle>
            <DialogDescription>{t("dialogoDesc")}</DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            {recordActual && <p className="text-xs text-muted-foreground">{t("recordActual", { record: recordActual })}</p>}
            <Label htmlFor="nuevo-record">{t("nuevoRecord")}</Label>
            <Input id="nuevo-record" value={valor} onChange={(e) => setValor(e.target.value)} autoFocus />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)} disabled={busy}>{tc("cancel")}</Button>
            <Button onClick={confirmar} disabled={busy || !valor.trim()}>{tc("confirm")}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
