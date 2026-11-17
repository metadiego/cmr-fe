"use client";

import * as React from "react";
import { useTranslations } from "next-intl";

import { updateProfile, type Perfil } from "@/lib/api/profiles";
import { missingFields } from "@/lib/forms/missing";
import { Input } from "@/components/ui/input";
import { FormDialog, Field } from "@/components/kit/form-dialog";
import { useSubmit } from "@/components/kit/use-submit";
import { useDialogForm } from "@/components/kit/use-dialog-form";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

type AccessMode = "operativo" | "gerencial";

/** Admin edit of a profile (D5): first name, last name and access mode. */
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
  const [form, update] = useDialogForm(
    () => ({
      nombre: profile?.name ?? "",
      apellido: profile?.lastName ?? "",
      accessMode: (profile?.accessMode === "gerencial" ? "gerencial" : "operativo") as AccessMode,
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
        accessMode: form.accessMode,
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
      onSubmit={() => submit()}
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
      <Field label={t("accessMode")} htmlFor="profile-edit-access-mode" hint={t("accessModeHelp")}>
        <Select
          value={form.accessMode}
          onValueChange={(v) => update({ accessMode: v as AccessMode })}
        >
          <SelectTrigger
            id="profile-edit-access-mode"
            className="w-full"
            aria-describedby="profile-edit-access-mode-hint"
          >
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="operativo">{t("operativo")}</SelectItem>
            <SelectItem value="gerencial">{t("gerencial")}</SelectItem>
          </SelectContent>
        </Select>
      </Field>
    </FormDialog>
  );
}
