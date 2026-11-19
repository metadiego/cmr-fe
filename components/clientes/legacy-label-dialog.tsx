"use client";

import { useTranslations } from "next-intl";
import { toast } from "sonner";

import { correctLegacyLabel } from "@/lib/api/legacy-numbering";
import { legacyLabelCheck } from "@/lib/frontdesk/legacy-numbering-missing";
import { missingFields } from "@/lib/forms/missing";
import { FormDialog } from "@/components/kit/form-dialog";
import { Field } from "@/components/kit/field";
import { RequiredLegend } from "@/components/kit/required-mark";
import { useDialogForm } from "@/components/kit/use-dialog-form";
import { useSubmit } from "@/components/kit/use-submit";
import { Input } from "@/components/ui/input";

// «Corregir numeración» of ONE migrated session (its «n/m» is legacy text, no package behind it).
// Handoff docs/specs/numeracion-de-sesiones-migradas-handoff.md.
export function LegacyLabelDialog({
  open,
  onOpenChange,
  session,
  centerId,
  onDone,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  session: { id: string; number: number | null; total: number | null; label: string };
  centerId: string;
  onDone: () => void;
}) {
  const t = useTranslations("legacyLabel");
  const [f, set] = useDialogForm(
    () => ({ number: session.number != null ? String(session.number) : "", total: session.total != null ? String(session.total) : "", reason: "" }),
    open,
    session.id,
  );
  const c = legacyLabelCheck(f);
  const saving = useSubmit(
    () => correctLegacyLabel(session.id, { number: c.number!, total: c.total!, reason: f.reason.trim() }, centerId),
    {
      onSuccess: (r) => {
        toast.success(t("corrected", { before: r.before ?? session.label, after: r.after }));
        onOpenChange(false);
        onDone();
      },
    },
  );
  const missing = missingFields([
    [t("session"), c.filled.number],
    [t("of"), c.filled.total],
    [t("reason"), c.filled.reason],
  ]);

  return (
    <FormDialog
      open={open}
      onOpenChange={onOpenChange}
      size="sm"
      title={t("correct")}
      description={session.label}
      onSubmit={() => saving.submit()}
      submitting={saving.submitting}
      missing={missing}
      reason={c.invalid ? t("rangeHint") : null}
      blocked={c.invalid}
    >
      <RequiredLegend />
      <div className="grid grid-cols-2 gap-3">
        <Field label={t("session")} htmlFor="legacy-n" required>
          <Input id="legacy-n" inputMode="numeric" value={f.number} onChange={(e) => set({ number: e.target.value })} aria-invalid={c.invalid} className="tabular-nums" />
        </Field>
        <Field label={t("of")} htmlFor="legacy-m" required>
          <Input id="legacy-m" inputMode="numeric" value={f.total} onChange={(e) => set({ total: e.target.value })} aria-invalid={c.invalid} className="tabular-nums" />
        </Field>
      </div>
      <Field label={t("reason")} htmlFor="legacy-reason" required hint={t("reasonHint")}>
        <Input id="legacy-reason" value={f.reason} maxLength={200} onChange={(e) => set({ reason: e.target.value })} />
      </Field>
    </FormDialog>
  );
}
