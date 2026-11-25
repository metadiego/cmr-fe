"use client";

import { useTranslations } from "next-intl";

import { missingFields } from "@/lib/forms/missing";
import { Field } from "@/components/kit/field";
import { FormDialog } from "@/components/kit/form-dialog";
import { useDialogForm } from "@/components/kit/use-dialog-form";
import { useSubmit } from "@/components/kit/use-submit";
import { Textarea } from "@/components/ui/textarea";

// Cancelling an appointment or session from the patient rail (rule 8/10: a destructive action lives in the
// card's ⋮ menu and confirms here). The reason is required by the BE. Irreversible, so Enter never fires
// it: only the red button does. `onCancel` toasts its own failure and leaves the dialog open with the text.
export function CancelAppointmentDialog({
  open,
  appointmentId,
  description,
  title,
  confirmLabel,
  onKeep,
  onCancel,
}: {
  open: boolean;
  appointmentId: string;
  /** What is being cancelled: "Láser · Mon, Nov 23 · 10:00". */
  description: string;
  /** Overrides for a cancel that means something else (an arrived patient: "not served"). */
  title?: string;
  confirmLabel?: string;
  onKeep: () => void;
  onCancel: (reason: string) => Promise<void>;
}) {
  const t = useTranslations("appointmentsBooking.patient");
  const [f, set] = useDialogForm(() => ({ reason: "" }), open, appointmentId);
  const reason = f.reason.trim();
  const fieldId = `cancel-reason-${appointmentId}`;
  const { submitting, submit } = useSubmit(() => onCancel(reason));
  const missing = missingFields([[t("cancelReasonLabel"), reason !== ""]]);

  return (
    <FormDialog
      open={open}
      onOpenChange={(o) => {
        if (!o) onKeep();
      }}
      size="sm"
      title={title ?? t("cancelTitle")}
      description={description}
      onSubmit={() => {}}
      actions={[{ label: confirmLabel ?? t("confirmCancel"), variant: "destructive", onClick: () => submit() }]}
      cancelLabel={t("keep")}
      submitting={submitting}
      missing={missing}
    >
      <Field label={t("cancelReasonLabel")} htmlFor={fieldId} required>
        <Textarea
          id={fieldId}
          value={f.reason}
          onChange={(e) => set({ reason: e.target.value })}
          placeholder={t("cancelReasonPlaceholder")}
          rows={3}
          autoFocus
        />
      </Field>
    </FormDialog>
  );
}
