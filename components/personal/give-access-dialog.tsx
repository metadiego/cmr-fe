"use client";

import * as React from "react";
import { useTranslations } from "next-intl";

import type { Personal } from "@/lib/api/personal";
import { inviteUser } from "@/lib/api/profiles";
import { setStaffPositions } from "@/lib/api/positions";
import { missingFields } from "@/lib/forms/missing";
import { hasAnyPosition } from "@/lib/admin/invite";
import { buildPositionsBody, chipState } from "@/lib/personal/positions";
import { staffFullName as nombreDe } from "@/lib/personal/staff-name";
import { useMe, isAdmin } from "@/hooks/use-me";
import { EmailInput } from "@/components/email-input";
import { FormDialog, Field } from "@/components/kit/form-dialog";
import { useSubmit } from "@/components/kit/use-submit";
import { usePositionsDraft } from "@/components/personal/use-positions-draft";
import { PositionsPicker } from "@/components/personal/positions-picker";

// "Give system access" to a staff record: an email and the person's positions (what they do and
// where; docs/specs/positions-and-centers.md). It starts from the positions the record already holds,
// since the save sends the complete list. `centro` is the person's home clinic.
export function DarAccesoDialog({
  persona, centro, onClose, onDone,
}: {
  persona: Personal;
  centro?: string;
  onClose: () => void;
  onDone: () => void;
}) {
  const t = useTranslations("personalFicha");
  const tp = useTranslations("staffPositions");
  const tRoot = useTranslations();
  const me = useMe();
  const viewerIsAdmin = me.kind === "ok" && isAdmin(me.me);
  const [email, setEmail] = React.useState(persona.email ?? "");
  const draft = usePositionsDraft(persona.id, true, centro);

  const missing = missingFields([
    [t("correo"), !!email.trim()],
    [tp("inviteMissing"), hasAnyPosition(draft.grid)],
  ]);

  // PERSONAL_YA_TIENE_CUENTA / PERSONAL_NO_EXISTE → the BE message (labelKey), via useSubmit's toast.
  const { submitting, submit } = useSubmit(
    async () => {
      // No center on the invite: cmr-be then skips its "serves in that center" check, and the positions
      // saved right after say where the person works.
      await inviteUser({
        email: email.trim(),
        name: persona.name,
        lastName: persona.lastName ?? undefined,
        staffId: persona.id,
        redirectTo: `${window.location.origin}/auth/set-password`,
      });
      await setStaffPositions(persona.id, buildPositionsBody(draft.grid, draft.primary, draft.catalog), centro);
    },
    { successMessage: t("accesoDado", { nombre: nombreDe(persona) }), onSuccess: onDone },
  );

  return (
    // Giving access sends an invitation email (outward): Enter never fires it, only the button does.
    <FormDialog
      open
      onOpenChange={(o) => !o && onClose()}
      size="lg"
      title={t("darAccesoTitulo", { nombre: nombreDe(persona) })}
      description={t("darAccesoDesc")}
      missing={missing}
      blocked={!draft.ready}
      reason={draft.failure ?? (draft.ready ? undefined : tRoot("common.loading"))}
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
      <Field label={tp("inviteTitle")} hint={tp("inviteHelp")}>
        {draft.ready && (
          <PositionsPicker
            idPrefix={`give-access-${persona.id}`}
            catalog={draft.catalog}
            centers={draft.centers}
            grid={draft.grid}
            onChange={draft.setGrid}
            primary={draft.primary}
            onPrimaryChange={draft.setPrimary}
            viewerIsAdmin={viewerIsAdmin}
            blockOf={(position, centerId) =>
              chipState({ position, centerId, grid: draft.grid, viewerIsAdmin, hasLogin: false, canEditCenter: true })
            }
          />
        )}
      </Field>
    </FormDialog>
  );
}
