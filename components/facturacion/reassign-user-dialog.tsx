"use client";

import * as React from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";

import { listPersonalAll } from "@/lib/api/personal";
import { missingFields } from "@/lib/forms/missing";
import { reassignCheck, reassignOptions, staffName } from "@/lib/facturacion/reassign-user-missing";
import { useResource } from "@/hooks/use-resource";
import { FormDialog } from "@/components/kit/form-dialog";
import { Field } from "@/components/kit/field";
import { useDialogForm } from "@/components/kit/use-dialog-form";
import { useSubmit } from "@/components/kit/use-submit";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

// «Cambiar usuario» (owner 19-nov-2026: «que cambiar el cajero sea una tarea simple»): one picker of the
// center's active staff and one call — the payment, or the refund with its active reimbursements, moves to
// that cashier without voiding anything (cmr-be #644). Moving money between cashiers' sheets is a cash
// action, so only the button fires it, never Enter. Errors (PAYMENT_NOT_ACTIVE, STAFF_NOT_ACTIVE,
// CASH_PAST_DAY_LOCKED) arrive with their labelKey and the shared toast translates them.
export function ReassignUserDialog({
  open,
  onOpenChange,
  recordId,
  description,
  currentUserId,
  centerId,
  save,
  onDone,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  /** Resets the picker when another payment/refund opens the same dialog. */
  recordId: string;
  /** What is being reassigned, e.g. «Visa · $6740.00». */
  description: string;
  currentUserId?: string | null;
  centerId?: string;
  save: (userId: string) => Promise<unknown>;
  onDone: () => void;
}) {
  const t = useTranslations("reassignUser");
  const [f, set] = useDialogForm(() => ({ userId: currentUserId ?? "" }), open, recordId);
  const staff = useResource(() => (open ? listPersonalAll({}, centerId) : Promise.resolve([])), [open, centerId]);
  const options = reassignOptions(staff.state.kind === "ok" ? staff.state.data : []);
  const picked = options.find((s) => s.id === f.userId);
  const c = reassignCheck(f.userId, currentUserId);

  const saving = useSubmit(() => save(f.userId), {
    onSuccess: () => {
      toast.success(t("done", { name: picked ? staffName(picked) : "" }));
      onOpenChange(false);
      onDone();
    },
  });
  const missing = missingFields([[t("user"), c.filled]]);
  const why = staff.state.kind === "loading" ? t("loadingStaff") : staff.state.kind === "fail" ? t("staffFailed") : c.same ? t("same") : null;

  return (
    <FormDialog
      open={open}
      onOpenChange={onOpenChange}
      size="sm"
      title={t("title")}
      description={description}
      onSubmit={() => {}}
      actions={[{ label: t("action"), onClick: () => saving.submit() }]}
      submitting={saving.submitting}
      missing={missing}
      reason={why}
      blocked={!!why}
    >
      <Field label={t("user")} htmlFor="reassign-user" required hint={t("hint")}>
        <Select value={f.userId} onValueChange={(v) => set({ userId: v })}>
          <SelectTrigger id="reassign-user" className="w-full">
            <SelectValue placeholder={t("pick")} />
          </SelectTrigger>
          <SelectContent>
            {options.map((s) => (
              <SelectItem key={s.id} value={s.id}>
                {staffName(s) || s.id}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </Field>
    </FormDialog>
  );
}
