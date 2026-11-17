"use client";

import * as React from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";

import { createClient } from "@/lib/supabase/client";
import { Input } from "@/components/ui/input";
import { FormDialog } from "@/components/kit/form-dialog";
import { Field } from "@/components/kit/field";
import { useDialogForm } from "@/components/kit/use-dialog-form";
import { useSubmit } from "@/components/kit/use-submit";
import { missingFields } from "@/lib/forms/missing";

// "Forgot password": sends a Supabase recovery email whose link lands on
// /auth/set-password (which handles type=recovery). redirectTo is per-request so
// it works in dev and prod.
export function ForgotPasswordDialog() {
  const t = useTranslations("login");
  const [open, setOpen] = React.useState(false);
  const [form, update] = useDialogForm(() => ({ email: "" }), open);

  const missing = missingFields([[t("email"), form.email.trim().length > 0]]);

  const { submitting, submit } = useSubmit(
    async () => {
      const { error } = await createClient().auth.resetPasswordForEmail(
        form.email.trim(),
        { redirectTo: `${window.location.origin}/auth/set-password` },
      );
      if (error) throw error;
    },
    {
      successMessage: t("forgotSent"),
      onSuccess: () => setOpen(false),
      onError: (err) => {
        toast.error(err instanceof Error ? err.message : String(err));
        return true;
      },
    },
  );

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="text-xs text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
      >
        {t("forgot")}
      </button>
      {/* Sends an email: only the button sends it; Enter in the field does nothing (as before). */}
      <FormDialog
        open={open}
        onOpenChange={setOpen}
        size="md"
        title={t("forgotTitle")}
        description={t("forgotDescription")}
        onSubmit={() => {}}
        actions={[{ label: t("forgotSend"), onClick: () => submit() }]}
        submittingLabel={t("forgotSending")}
        cancelLabel={t("cancel")}
        submitting={submitting}
        missing={missing}
      >
        <Field label={t("email")} htmlFor="forgot-email" required>
          <Input
            id="forgot-email"
            type="email"
            autoComplete="email"
            value={form.email}
            onChange={(e) => update({ email: e.target.value })}
            placeholder={t("emailPlaceholder")}
          />
        </Field>
      </FormDialog>
    </>
  );
}
