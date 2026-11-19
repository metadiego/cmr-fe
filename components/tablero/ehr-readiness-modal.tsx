"use client";

import * as React from "react";
import { useTranslations } from "next-intl";

import { updatePaciente } from "@/lib/api/pacientes";
import { type EhrReadinessField } from "@/lib/api/ehr-integration";
import { ID_TYPES } from "@/components/clientes/paciente-form-model";
import type { EhrGateCtx } from "@/components/tablero/flujo-atencion";
import { todayPR } from "@/lib/format/fecha";
import { ehrReadinessInvalid, ehrReadinessMissing, ehrReadinessOrder } from "@/lib/board/ehr-readiness-missing";
import { Input } from "@/components/ui/input";
import { DatePicker } from "@/components/ui/date-picker";
import { Field, FormDialog } from "@/components/kit/form-dialog";
import { RequiredLegend } from "@/components/kit/required-mark";
import { useSubmit } from "@/components/kit/use-submit";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

// BLOCKING dialog that asks for the data the EHR needs BEFORE marking Present. It paints ONLY the
// `faltantes` the readiness check reports, with the same control as the patient form, saves them with the
// usual PUT and only then lets the flow continue. Cancel = Present is not marked. Handoff be-ehr-integration-presente.

export function EhrReadinessModal({
  pacienteId,
  faltantes,
  centroId,
  onCancel,
  onCompleted,
  cancelLabel,
}: {
  pacienteId: string;
  faltantes: EhrReadinessField[];
  centroId?: string;
  onCancel: () => void;
  onCompleted: () => void;
  // §1b: a follow-up patient does not block — the button reads "Continue without completing" instead of
  // "Cancel", because `onCancel` DOES move on. Omitted = the normal lock.
  cancelLabel?: string;
}) {
  const t = useTranslations("patients.form");
  const te = useTranslations("ehrIntegration");
  const [form, setForm] = React.useState<Record<string, string>>({});
  const idPrefix = React.useId();

  const set = (k: string, v: string) => setForm((f) => ({ ...f, [k]: v }));
  const ordered = ehrReadinessOrder(faltantes);
  const missing = ehrReadinessMissing(faltantes, form).map((f) => t(f));
  // A future birth date is an impossible value. The input's `max` stops most browsers, this is the real
  // backstop (a value can be pasted) — same rule as paciente-form-sheet.tsx.
  const futureBirthDate = ehrReadinessInvalid(form, todayPR()) === "futureBirthDate";
  const futureBirthDateText = futureBirthDate ? t("fechaNacimientoFutura") : null;
  // The ID cannot be typed until the type is chosen (only when the type is also being asked here).
  const idTypeMissing = faltantes.includes("idType");
  const docIdLocked = (f: EhrReadinessField) => f === "docId" && idTypeMissing && !form.idType;

  const { submitting, submit } = useSubmit(
    async () => {
      // Only the fields that were missing. `idType` is not in the typed DTO yet (schema to regenerate) → cast.
      const payload: Record<string, string> = {};
      for (const f of faltantes) payload[f] = (form[f] ?? "").trim();
      await updatePaciente(pacienteId, payload as never, centroId);
    },
    { onSuccess: onCompleted },
  );

  return (
    <FormDialog
      open
      onOpenChange={(o) => !o && onCancel()}
      title={te("modalTitle")}
      description={te("modalHelp")}
      size="md"
      onSubmit={() => submit()}
      submitLabel={te("saveAndContinue")}
      submittingLabel={te("saving")}
      cancelLabel={cancelLabel}
      submitting={submitting}
      missing={missing}
      reason={futureBirthDateText}
      blocked={futureBirthDate}
    >
      {ordered.length >= 3 && <RequiredLegend />}
      {ordered.map((f) => {
        const id = `${idPrefix}-${f}`;
        const error = f === "fechaNacimiento" ? futureBirthDateText : null;
        return (
          <Field key={f} label={t(f)} htmlFor={id} required error={error}>
            {f === "idType" ? (
              <Select value={form[f] || undefined} onValueChange={(v) => set(f, v)}>
                <SelectTrigger id={id} className="w-full"><SelectValue placeholder={t("idTypePlaceholder")} /></SelectTrigger>
                <SelectContent>
                  {ID_TYPES.map((v) => (
                    <SelectItem key={v} value={v}>{t(`idType_${v}`)}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            ) : f === "sexo" ? (
              <Select value={form[f] || undefined} onValueChange={(v) => set(f, v)}>
                <SelectTrigger id={id} className="w-full"><SelectValue placeholder={t("sexoPlaceholder")} /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="femenino">{t("sexoFemenino")}</SelectItem>
                  <SelectItem value="masculino">{t("sexoMasculino")}</SelectItem>
                  <SelectItem value="otro">{t("sexoOtro")}</SelectItem>
                  <SelectItem value="desconocido">{t("sexoDesconocido")}</SelectItem>
                </SelectContent>
              </Select>
            ) : f === "fechaNacimiento" ? (
              <DatePicker
                id={id}
                value={form[f] ?? ""}
                onChange={(v) => set(f, v)}
                birthDate
                max={todayPR()}
                aria-invalid={error ? true : undefined}
                aria-describedby={error ? `${id}-error` : undefined}
              />
            ) : (
              <Input
                id={id}
                type="text"
                value={form[f] ?? ""}
                aria-invalid={error ? true : undefined}
                aria-describedby={error ? `${id}-error` : undefined}
                onChange={(e) => set(f, e.target.value)}
                disabled={docIdLocked(f)}
                placeholder={docIdLocked(f) ? t("idTypeFirst") : undefined}
              />
            )}
          </Field>
        );
      })}
    </FormDialog>
  );
}

// The "if there is a gate, paint the dialog; cancel or complete closes it and moves on" wiring was repeated
// verbatim on every screen that adopted it (tablero-dinamico.tsx, dia-view.tsx ×2, frontdesk-board.tsx)
// — one piece instead of 4 copies of the same block (handoff quejas-de-mostrador-2026-10-20 §1).
export function EhrGateHost({
  gate,
  centroId,
  onClose,
}: {
  gate: EhrGateCtx | null;
  centroId?: string;
  onClose: () => void;
}) {
  const te = useTranslations("ehrIntegration");
  if (!gate) return null;
  return (
    <EhrReadinessModal
      pacienteId={gate.pacienteId}
      faltantes={gate.faltantes}
      centroId={centroId}
      cancelLabel={gate.skip ? te("skipLabel") : undefined}
      onCancel={() => {
        onClose();
        gate.skip?.();
      }}
      onCompleted={() => {
        onClose();
        gate.onCompleted();
      }}
    />
  );
}
