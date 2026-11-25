"use client";

import * as React from "react";
import { useTranslations } from "next-intl";

import { DatePicker } from "@/components/ui/date-picker";
import { TimePicker } from "@/components/ui/time-picker";
import { Field } from "@/components/kit/field";
import { FormDialog } from "@/components/kit/form-dialog";
import { useDialogForm } from "@/components/kit/use-dialog-form";
import { useSubmit } from "@/components/kit/use-submit";
import { moveSession, type DayListRow } from "@/lib/api/appointments-day";
import { missingFields } from "@/lib/forms/missing";
import { refusalRefreshesRow } from "@/lib/lifecycle/board-action-rules";
import { mostrarAvisos } from "@/lib/frontdesk/avisos";

// Moving a therapy session in place (`move`, PATCH frontdesk/sessions/:id/agenda): a new day and,
// optionally, a time (empty keeps the current one: the backend's `hora ?? sesion.hora`). The new day's
// slot warnings show as toasts, as on the other booking screens. Moving is an outward change (rule 8):
// only the button fires it, never Enter.
export function MoveSessionDialog({
  row,
  open,
  onClose,
  onMoved,
}: {
  row: DayListRow;
  open: boolean;
  onClose: () => void;
  onMoved: () => void;
}) {
  const t = useTranslations("appointmentsDay.move");
  const tc = useTranslations("common");
  const tRoot = useTranslations();
  const [f, set] = useDialogForm(() => ({ date: "", time: row.time ?? "" }), open, row.id);
  const dateId = `move-date-${row.id}`;
  const timeId = `move-time-${row.id}`;
  const { submitting, submit } = useSubmit(() => moveSession(row, f.date, f.time || undefined), {
    successMessage: tc("saved"),
    onSuccess: (res) => {
      mostrarAvisos(res.warnings, tRoot);
      onClose();
      onMoved();
    },
    onError: (err) => {
      if (refusalRefreshesRow(err)) {
        onClose();
        onMoved();
      }
      return false;
    },
  });
  const missing = missingFields([[t("date"), f.date !== ""]]);

  return (
    <FormDialog
      open={open}
      onOpenChange={(o) => !o && onClose()}
      size="sm"
      title={t("title")}
      description={[row.serviceName, row.patient.name].filter(Boolean).join(" · ")}
      onSubmit={() => {}}
      actions={[{ label: t("submit"), onClick: () => submit() }]}
      submitting={submitting}
      missing={missing}
    >
      <Field label={t("date")} htmlFor={dateId} required>
        <DatePicker id={dateId} value={f.date} onChange={(d) => set({ date: d })} />
      </Field>
      <Field label={t("time")} htmlFor={timeId} hint={t("timeHint")}>
        <TimePicker id={timeId} value={f.time} onChange={(v) => set({ time: v })} />
      </Field>
    </FormDialog>
  );
}
