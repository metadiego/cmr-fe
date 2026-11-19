"use client";

import * as React from "react";
import { useTranslations } from "next-intl";

import { cambiarEmailPerfil, type Perfil } from "@/lib/api/profiles";
import { apiErrorMessage } from "@/lib/api/errors";
import { missingFields } from "@/lib/forms/missing";
import { EmailInput } from "@/components/email-input";
import { FormDialog, Field } from "@/components/kit/form-dialog";
import { FormError } from "@/components/kit/field";
import { useSubmit } from "@/components/kit/use-submit";
import { useDialogForm } from "@/components/kit/use-dialog-form";

// Changes a profile's LOGIN email (admin/super_admin, permission profiles.email). Separate from the
// staff record form, and deliberate: it moves the address in Supabase + our table, signs the person
// out of open sessions and updates their staff record. The password is unchanged.
// Handoff cambiar-email-de-perfil-handoff-be.
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function CambiarEmailDialog({
  perfil,
  onClose,
  onSaved,
}: {
  perfil: Perfil | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const t = useTranslations("admin.users.email");
  const open = perfil != null;
  // Seeded with the current address as a starting point; re-seeded when another profile opens.
  const [form, update] = useDialogForm(
    () => ({ email: perfil?.email ?? "", error: null as string | null }),
    open,
    perfil?.id,
  );

  const nuevo = form.email.trim().toLowerCase();
  const missing = missingFields([[t("label"), nuevo !== ""]]);
  const invalid = nuevo !== "" && !EMAIL_RE.test(nuevo);
  const unchanged = !!perfil && nuevo === (perfil.email ?? "").trim().toLowerCase();
  const reason = invalid ? t("invalido") : unchanged ? t("unchanged") : null;

  const { submitting, submit } = useSubmit(
    async () => {
      if (!perfil) throw new Error("no profile"); // unreachable: the dialog is open only with a profile
      update({ error: null });
      await cambiarEmailPerfil(perfil.id, nuevo);
    },
    {
      successMessage: t("ok"),
      onSuccess: () => {
        onSaved();
        onClose();
      },
      // 409 (email already used / master's reserved address / master profile) → the BE message as is.
      onError: (e) => {
        update({ error: apiErrorMessage(e) });
        return true;
      },
    },
  );

  return (
    <FormDialog
      open={open}
      onOpenChange={(o) => !o && onClose()}
      size="md"
      title={t("titulo")}
      description={t("desc", {
        nombre: perfil ? [perfil.name, perfil.lastName].filter(Boolean).join(" ") : "",
      })}
      onSubmit={() => submit()}
      submitting={submitting}
      missing={missing}
      reason={reason}
      blocked={invalid || unchanged}
      submitLabel={t("guardar")}
      submittingLabel={t("guardando")}
      cancelLabel={t("cancelar")}
    >
      <Field label={t("label")} htmlFor="change-email-input" required>
        <EmailInput
          id="change-email-input"
          value={form.email}
          onValueChange={(v) => update({ email: v, error: null })}
          placeholder={t("placeholder")}
          disabled={submitting}
          autoFocus
          // Changing a login email is outward and signs the person out: Enter never fires it.
          onKeyDown={(e) => {
            if (e.key === "Enter") e.preventDefault();
          }}
        />
      </Field>
      <p className="rounded-lg bg-warning px-3 py-2 text-xs text-warning-foreground">{t("aviso")}</p>
      <FormError message={form.error} />
    </FormDialog>
  );
}
