"use client";

import * as React from "react";
import { useTranslations } from "next-intl";

import { FormDialog, Field } from "@/components/kit/form-dialog";
import { useSubmit } from "@/components/kit/use-submit";
import { Textarea } from "@/components/ui/textarea";
import { missingFields } from "@/lib/forms/missing";
import { voidSheetAnswers, type SheetAnswers } from "@/lib/api/format-answers";
import { VOID_REASON, voidReasonFilled, voidReasonProblem } from "@/lib/format-sheet/void-sheet-missing";

// Takes a saved sheet down with a reason (cmr-be #685). Irreversible from here, so Enter never fires it:
// only the button does. The BE's own confirmation (428) is answered by the shared dialog in the shell.
export function VoidSheetDialog({
  slug,
  sessionId,
  centerId,
  onClose,
  onVoided,
}: {
  slug: string;
  sessionId: string;
  centerId?: string;
  onClose: () => void;
  onVoided: (sheet: SheetAnswers) => void;
}) {
  const t = useTranslations("formSheet.sheet.void");
  const [reason, setReason] = React.useState("");

  const missing = missingFields([[t("reason"), voidReasonFilled(reason)]]);
  const problem = voidReasonProblem(reason);
  const problemText = problem ? t(problem, { min: VOID_REASON.min, max: VOID_REASON.max }) : null;

  const { submitting, submit } = useSubmit(() => voidSheetAnswers(slug, sessionId, reason, centerId), {
    successMessage: t("done"),
    onSuccess: onVoided,
  });

  return (
    <FormDialog
      open
      onOpenChange={(o) => !o && onClose()}
      size="md"
      title={t("title")}
      description={t("description")}
      missing={missing}
      reason={problemText}
      blocked={!!problem}
      submitting={submitting}
      submittingLabel={t("voiding")}
      onSubmit={() => {}}
      actions={[{ label: t("action"), variant: "destructive", onClick: () => submit() }]}
    >
      <Field label={t("reason")} htmlFor="void-sheet-reason" required hint={t("reasonHint")}>
        <Textarea
          id="void-sheet-reason"
          rows={3}
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          className="text-base"
        />
      </Field>
    </FormDialog>
  );
}
