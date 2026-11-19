"use client";

import * as React from "react";
import { useTranslations } from "next-intl";

import type { Personal } from "@/lib/api/personal";
import type { Rol } from "@/lib/api/rbac";
import { inviteUser } from "@/lib/api/profiles";
import { missingFields } from "@/lib/forms/missing";
import { staffFullName as nombreDe } from "@/lib/personal/staff-name";
import { EmailInput } from "@/components/email-input";
import { FormDialog, Field } from "@/components/kit/form-dialog";
import { useSubmit } from "@/components/kit/use-submit";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

// "Give system access" to a staff record. `centro` is the person's home clinic: the account is
// assigned there as its base clinic.
export function DarAccesoDialog({
  persona, roles, centro, onClose, onDone,
}: {
  persona: Personal;
  roles: Rol[];
  centro?: string;
  onClose: () => void;
  onDone: () => void;
}) {
  const t = useTranslations("personalFicha");
  const [email, setEmail] = React.useState(persona.email ?? "");
  const [rolClave, setRolClave] = React.useState("");

  const missing = missingFields([
    [t("correo"), !!email.trim()],
    [t("rol"), !!rolClave],
  ]);

  // PERSONAL_YA_TIENE_CUENTA / PERSONAL_DE_OTRO_CENTRO / PERSONAL_NO_EXISTE → the BE message (labelKey),
  // via useSubmit's default error toast.
  const { submitting, submit } = useSubmit(
    async () => {
      // ONE call: creates the account, links it to the staff record (staffId), grants the role and assigns the clinic.
      await inviteUser({
        email: email.trim(),
        name: persona.name,
        lastName: persona.lastName ?? undefined,
        staffId: persona.id,
        rolClave,
        centerId: centro,
        tipoAsignacion: "base",
        redirectTo: `${window.location.origin}/auth/set-password`,
      });
    },
    { successMessage: t("accesoDado", { nombre: nombreDe(persona) }), onSuccess: onDone },
  );

  return (
    // Giving access sends an invitation email (outward): Enter never fires it, only the button does.
    <FormDialog
      open
      onOpenChange={(o) => !o && onClose()}
      size="md"
      title={t("darAccesoTitulo", { nombre: nombreDe(persona) })}
      description={t("darAccesoDesc")}
      missing={missing}
      submitting={submitting}
      submittingLabel={t("dando")}
      onSubmit={() => {}}
      actions={[{ label: t("darAcceso"), onClick: () => submit() }]}
    >
      <Field label={t("correo")} htmlFor="give-access-email" required>
        <EmailInput
          id="give-access-email"
          value={email}
          onValueChange={setEmail}
          placeholder="persona@correo.com"
        />
      </Field>
      <Field label={t("rol")} htmlFor="give-access-role" required>
        <Select value={rolClave || undefined} onValueChange={setRolClave}>
          <SelectTrigger id="give-access-role" className="w-full">
            <SelectValue placeholder={t("rolPlaceholder")} />
          </SelectTrigger>
          <SelectContent>
            {roles.map((r) => <SelectItem key={r.id} value={r.slug}>{r.name}</SelectItem>)}
          </SelectContent>
        </Select>
      </Field>
    </FormDialog>
  );
}
