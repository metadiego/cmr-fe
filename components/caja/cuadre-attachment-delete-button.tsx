"use client";

import * as React from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { HugeiconsIcon } from "@hugeicons/react";
import { Delete02Icon } from "@hugeicons/core-free-icons";

import { deleteCashAttachment } from "@/lib/api/caja";
import { toastError } from "@/lib/api/errors";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

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
  const tRoot = useTranslations();
  const [open, setOpen] = React.useState(false);
  const [reason, setReason] = React.useState("");
  const [busy, setBusy] = React.useState(false);

  async function confirmDelete() {
    setBusy(true);
    try {
      await deleteCashAttachment(reconciliationId, attachmentId, reason.trim(), centroId);
      toast.success(t("deleted"));
      setOpen(false);
      setReason("");
      onDeleted();
    } catch (err) {
      toastError(err, tRoot);
    } finally {
      setBusy(false);
    }
  }

  return (
    <AlertDialog open={open} onOpenChange={(v) => !busy && setOpen(v)}>
      <Button type="button" size="icon-sm" variant="ghost" className="text-destructive" onClick={() => setOpen(true)} aria-label={t("delete")}>
        <HugeiconsIcon icon={Delete02Icon} className="size-4" />
      </Button>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{t("deleteConfirmTitle")}</AlertDialogTitle>
          <AlertDialogDescription>{t("deleteConfirmDesc")}</AlertDialogDescription>
        </AlertDialogHeader>
        <div className="space-y-1.5">
          <Label htmlFor={`del-reason-${attachmentId}`}>{t("deleteReasonLabel")}</Label>
          <Textarea id={`del-reason-${attachmentId}`} value={reason} onChange={(e) => setReason(e.target.value)} placeholder={t("deleteReasonPlaceholder")} autoFocus />
        </div>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={busy}>{t("deleteCancel")}</AlertDialogCancel>
          <Button variant="destructive" onClick={confirmDelete} disabled={busy || reason.trim().length < 3}>
            {t("deleteConfirm")}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
