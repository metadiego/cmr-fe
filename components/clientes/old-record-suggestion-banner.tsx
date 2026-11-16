"use client";

import * as React from "react";
import { useTranslations } from "next-intl";

import { getOldRecordSuggestion, replaceRecord, type OldRecordSuggestion } from "@/lib/api/pacientes";
import { missingFields } from "@/lib/forms/missing";
import { useResource } from "@/hooks/use-resource";
import { Field, FormDialog } from "@/components/kit/form-dialog";
import { useSubmit } from "@/components/kit/use-submit";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

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
  const { state, reload } = useResource<OldRecordSuggestion>(
    () => getOldRecordSuggestion(patientId, centroId),
    [patientId, centroId],
  );
  const [open, setOpen] = React.useState(false);
  const [valor, setValor] = React.useState("");
  const { submitting, submit } = useSubmit(() => replaceRecord(patientId, valor.trim() || undefined, centroId), {
    successMessage: t("guardado"),
    onSuccess: () => {
      setOpen(false);
      onReemplazado();
      reload();
    },
  });
  const missing = missingFields([[t("nuevoRecord"), !!valor.trim()]]);

  const sugerencia = state.kind === "ok" ? state.data : null;
  if (!sugerencia?.suggested) return null;

  function abrir() {
    setValor(sugerencia?.suggestedRecord ?? "");
    setOpen(true);
  }

  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-warning/40 bg-warning/10 px-4 py-3 text-sm">
        <span>{t("aviso", { years: sugerencia.yearsInactive ?? 0 })}</span>
        <Button size="sm" onClick={abrir}>{t("asignar")}</Button>
      </div>

      <FormDialog
        open={open}
        onOpenChange={setOpen}
        size="sm"
        title={t("dialogoTitulo")}
        description={t("dialogoDesc")}
        onSubmit={() => submit()}
        submitLabel={tc("confirm")}
        submitting={submitting}
        missing={missing}
      >
        {recordActual && <p className="text-xs text-muted-foreground">{t("recordActual", { record: recordActual })}</p>}
        <Field label={t("nuevoRecord")} htmlFor="nuevo-record" required>
          <Input id="nuevo-record" value={valor} onChange={(e) => setValor(e.target.value)} autoFocus />
        </Field>
      </FormDialog>
    </>
  );
}
