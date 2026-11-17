"use client";

import * as React from "react";
import { useTranslations } from "next-intl";
import { HugeiconsIcon } from "@hugeicons/react";
import { Delete02Icon } from "@hugeicons/core-free-icons";

import { deleteCashAttachment } from "@/lib/api/caja";
import { attachmentDeleteInvalid, attachmentDeleteMissing } from "@/lib/caja/attachment-delete-missing";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { FormDialog, Field } from "@/components/kit/form-dialog";
import { useDialogForm } from "@/components/kit/use-dialog-form";
import { useSubmit } from "@/components/kit/use-submit";

// Eliminar un adjunto (BE PR #588, handoff docs/specs/eliminar-adjunto-cuadre-handoff-be.md): pide
// motivo (manda al BE, 3–500), y el 428 genérico que viene después lo resuelve el ConfirmActionHost
// de siempre (apiFetch ya lo maneja solo) — este diálogo solo recoge el motivo.
export function CuadreAttachmentDeleteButton({
  reconciliationId,
  centroId,
  attachmentId,
  onDeleted,
}: {
  reconciliationId: string;
  centroId?: string | null;
  attachmentId: string;
  onDeleted: () => void;
}) {
  const t = useTranslations("caja.attachments");
  const [open, setOpen] = React.useState(false);
  const [{ reason }, setForm] = useDialogForm(() => ({ reason: "" }), open, attachmentId);
  const missing = attachmentDeleteMissing({ reason }).map(() => t("deleteReasonLabel"));
  const problem = attachmentDeleteInvalid({ reason });
  const reasonId = `del-reason-${attachmentId}`;

  const { submitting, submit } = useSubmit(() => deleteCashAttachment(reconciliationId, attachmentId, reason.trim(), centroId), {
    successMessage: t("deleted"),
    onSuccess: () => {
      setOpen(false);
      onDeleted();
    },
  });

  return (
    <>
      <Button type="button" size="icon-sm" variant="ghost" className="text-destructive" onClick={() => setOpen(true)} aria-label={t("delete")}>
        <HugeiconsIcon icon={Delete02Icon} className="size-4" />
      </Button>
      <FormDialog
        open={open}
        onOpenChange={setOpen}
        title={t("deleteConfirmTitle")}
        description={t("deleteConfirmDesc")}
        onSubmit={() => submit()}
        actions={[{ label: t("deleteConfirm"), variant: "destructive", onClick: () => submit() }]}
        cancelLabel={t("deleteCancel")}
        submitting={submitting}
        missing={missing}
        reason={problem ? t("deleteReasonTooShort") : null}
        blocked={problem != null}
      >
        {/* A textarea: Enter adds a line and never submits, so deleting needs the button. */}
        <Field label={t("deleteReasonLabel")} htmlFor={reasonId} required>
          <Textarea
            id={reasonId}
            value={reason}
            onChange={(e) => setForm({ reason: e.target.value })}
            placeholder={t("deleteReasonPlaceholder")}
            autoFocus
          />
        </Field>
      </FormDialog>
    </>
  );
}
