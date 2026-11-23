"use client";

import { useTranslations } from "next-intl";

import { Textarea } from "@/components/ui/textarea";
import { Field } from "@/components/kit/field";
import { FormDialog } from "@/components/kit/form-dialog";
import { useDialogForm } from "@/components/kit/use-dialog-form";
import { useSubmit } from "@/components/kit/use-submit";
import type { DayPanelMoving } from "@/components/appointments-booking/day-panel";
import { missingFields } from "@/lib/forms/missing";

// Moving a rail appointment to the picked hour (the owner's "like the create modal, adapted to moving").
// A move is an outward action (rule 8): Enter never fires it, only the button does. Closing it (Cancel,
// Esc, ×) only un-picks the hour: move mode stays on. `onConfirm` toasts its own failure and leaves the
// dialog open with the typed reason; on success the screen shows the booking success dialog.
export function MoveAppointmentDialog({
  moving,
  typeName,
  toLabel,
  full,
  onClose,
}: {
  moving: DayPanelMoving;
  typeName: string;
  toLabel: string;
  full: boolean;
  onClose: () => void;
}) {
  const t = useTranslations("appointmentsBooking.move");
  // A fresh reason for every target hour.
  const [f, set] = useDialogForm(() => ({ reason: "" }), true, toLabel);
  const reason = f.reason.trim();
  const { submitting, submit } = useSubmit(() => moving.onConfirm(moving.needsReason ? reason : undefined));
  const missing = missingFields(moving.needsReason ? [[t("reasonLabel"), reason !== ""]] : []);

  return (
    <FormDialog
      open
      onOpenChange={(o) => {
        if (!o) onClose();
      }}
      size="md"
      title={t("dialogTitle")}
      description={typeName}
      onSubmit={() => {}}
      actions={[{ label: t("confirm"), onClick: () => submit() }]}
      submitting={submitting}
      missing={missing}
    >
      <p className="text-sm">{t("fromTo", { from: moving.fromLabel, to: toLabel })}</p>
      {full && <p className="text-sm text-warning-foreground">{t("fullWarning")}</p>}
      {moving.needsReason && (
        <Field label={t("reasonLabel")} htmlFor="booking-move-reason" required>
          <Textarea
            id="booking-move-reason"
            value={f.reason}
            onChange={(e) => set({ reason: e.target.value })}
            placeholder={t("reasonPlaceholder")}
            rows={2}
          />
        </Field>
      )}
    </FormDialog>
  );
}
