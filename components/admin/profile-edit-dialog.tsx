"use client";

import * as React from "react";
import { useTranslations } from "next-intl";

import { updateProfile, type Perfil } from "@/lib/api/profiles";
import { missingFields } from "@/lib/forms/missing";
import { Input } from "@/components/ui/input";
import { FormDialog, Field } from "@/components/kit/form-dialog";
import { useSubmit } from "@/components/kit/use-submit";
import { useDialogForm } from "@/components/kit/use-dialog-form";

/** Admin edit of a profile (D5): first name and last name (the backend ignores access mode since cmr-be #557). */
// Seeded from the profile and re-seeded on open / another profile (the caller also keys by profile id).
export function ProfileEditDialog({
  profile,
  open,
  onOpenChange,
  onSaved,
}: {
  profile: Perfil | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSaved?: () => void;
}) {
  const t = useTranslations("admin.editarPerfil");
  const tCommon = useTranslations("common");
  const [form, update] = useDialogForm(
    () => ({
      nombre: profile?.name ?? "",
      apellido: profile?.lastName ?? "",
    }),
    open,
    profile?.id,
  );

  const missing = missingFields([[t("nombre"), !!form.nombre.trim()]]);

  const { submitting, submit } = useSubmit(
    async () => {
      if (!profile) throw new Error("no profile"); // unreachable: the dialog is open only with a profile
      await updateProfile(profile.id, {
        name: form.nombre.trim(),
        lastName: form.apellido.trim() || null,
      });
    },
    {
      successMessage: t("guardado"),
      onSuccess: () => {
        onSaved?.();
        onOpenChange(false);
      },
    },
  );

  return (
    <FormDialog
      open={open}
      onOpenChange={onOpenChange}
      size="md"
      title={t("title", { email: profile?.email ?? "" })}
      description={t("help")}
      missing={missing}
      submitting={submitting}
      // Saving may change the access mode (what the person sees): Enter never fires it, only the button.
      onSubmit={() => {}}
      actions={[{ label: tCommon("save"), onClick: () => submit() }]}
    >
      <Field label={t("nombre")} htmlFor="profile-edit-first-name" required>
        <Input
          id="profile-edit-first-name"
          value={form.nombre}
          onChange={(e) => update({ nombre: e.target.value })}
        />
      </Field>
      <Field label={t("apellido")} htmlFor="profile-edit-last-name">
        <Input
          id="profile-edit-last-name"
          value={form.apellido}
          onChange={(e) => update({ apellido: e.target.value })}
        />
      </Field>
    </FormDialog>
  );
}
