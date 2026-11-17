"use client";

import * as React from "react";
import { useTranslations } from "next-intl";

import {
  provisionEhrStaff,
  updateEhrStaffLink,
  listEhrStaffLinks,
  type EhrRole,
  type EhrStaffLink,
} from "@/lib/api/ehr-integration";
import type { Personal } from "@/lib/api/personal";
import { suggestEhrRoleId } from "@/lib/personal/ehr-role-suggestion";
import { missingFields } from "@/lib/forms/missing";
import { useResource } from "@/hooks/use-resource";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { FormDialog, Field } from "@/components/kit/form-dialog";
import { useSubmit } from "@/components/kit/use-submit";

// «Vincular con el EHR»: crear/editar la cuenta del EHR externo para esta persona, con un clic.
// Handoff docs/specs/vincular-personal-con-el-ehr-handoff-fe.md. El botón va en TODA ficha de
// Personal, sin excepción (decisión del dueño, 01-oct-2026) — nunca se gatea por cargo/capacidad.
// Habilitar/deshabilitar NO necesita nada aquí: ya ocurre solo al dar de alta/baja a la persona.

export function EhrLinkSection({
  persona,
  roles,
  link,
  centerIds,
  centro,
  onChanged,
}: {
  persona: Personal;
  roles: EhrRole[];
  link: EhrStaffLink | undefined;
  // Todos los centros donde quien mira tiene ehr-integration.read — la cuenta del EHR no es por
  // centro, pero el BE la guarda contra el de alta, así que hay que pedirlos todos, no solo el activo.
  centerIds: string[] | undefined;
  centro?: string;
  onChanged: () => void;
}) {
  const t = useTranslations("personalFicha");
  const [open, setOpen] = React.useState(false);

  return (
    <div className="border-t pt-4">
      <Label className="mb-2 block">{t("ehrLabel")}</Label>
      {link ? (
        <div className="flex flex-wrap items-center gap-3 rounded-md border bg-muted/30 px-3 py-2 text-sm">
          <span>{link.ehrEmail}</span>
          <Button size="sm" variant="outline" className="ml-auto" onClick={() => setOpen(true)}>
            {t("ehrEditar")}
          </Button>
        </div>
      ) : (
        <div className="flex items-center justify-between gap-3">
          <span className="text-sm text-muted-foreground">{t("ehrSinVinculo")}</span>
          <Button size="sm" onClick={() => setOpen(true)}>{t("ehrVincular")}</Button>
        </div>
      )}
      {open && (
        <EhrLinkDialog
          persona={persona}
          roles={roles}
          link={link}
          centerIds={centerIds}
          centro={centro}
          onClose={() => setOpen(false)}
          onDone={() => {
            setOpen(false);
            onChanged();
          }}
        />
      )}
    </div>
  );
}

function EhrLinkDialog({
  persona,
  roles,
  link: linkSnapshot,
  centerIds,
  centro,
  onClose,
  onDone,
}: {
  persona: Personal;
  roles: EhrRole[];
  // Snapshot del padre (pudo quedar viejo si el page lleva rato abierto sin recargar, o si otra
  // pestaña/persona vinculó mientras tanto) — solo sirve para el primer render (botón Vincular vs
  // Editar). La fuente de verdad real es `freshRes` de abajo, releída al ABRIR este diálogo.
  link: EhrStaffLink | undefined;
  centerIds: string[] | undefined;
  centro?: string;
  onClose: () => void;
  onDone: () => void;
}) {
  const t = useTranslations("personalFicha");
  const tRoot = useTranslations();
  // Vuelve a pedir los vínculos justo al abrir — no confía en el snapshot del padre. Encontrado por
  // revisión adversarial (2026-10-01): sin esto, un vínculo creado por otra persona/pestaña mientras
  // la ficha estaba abierta se veía como "sin vincular" y disparaba un provision redundante. Pide
  // TODOS los centros (no solo el activo): la cuenta del EHR se guarda contra el centro de alta, no
  // contra la persona sola — verificado en vivo 2026-10-01 con Glorimar/Javier (de alta en Bayamón,
  // "sin vincular" al mirar desde Caguas).
  const freshRes = useResource<EhrStaffLink[]>(() => listEhrStaffLinks(centro, centerIds), [persona.id, centro, centerIds]);
  const link =
    freshRes.state.kind === "ok"
      ? freshRes.state.data.find((l) => l.staffId === persona.id)
      : linkSnapshot;
  const [roleId, setRoleId] = React.useState(() => suggestEhrRoleId(persona.jobTitle, roles) ?? "");
  const esNuevo = !link;
  const nombre = [persona.name, persona.lastName].filter(Boolean).join(" ").trim() || persona.name;

  // Linking (create) needs a real email: the EHR invites THAT address. Editing the role of an existing
  // link does not ask for it again, so it does not apply there. Without this, "Confirm" was gated only by
  // `roleId`, and an empty email sent a meaningless notice ("an email will be sent to —") and let it go
  // through anyway. Found by adversarial review (2026-10-01).
  const faltaCorreo = esNuevo && !persona.email;
  const loading = freshRes.state.kind === "loading";

  const missing = missingFields([[t("ehrRol"), !!roleId]]);
  const reason = faltaCorreo ? t("ehrFaltaCorreo") : loading ? tRoot("common.loading") : null;

  const { submitting, submit } = useSubmit(
    async () => {
      if (esNuevo) {
        await provisionEhrStaff(persona.id, roleId, centro);
      } else {
        await updateEhrStaffLink(persona.id, { ehrRoleId: roleId }, centro);
      }
    },
    { successMessage: t(esNuevo ? "ehrVinculado" : "ehrActualizado"), onSuccess: onDone },
  );

  return (
    // The shell ignores closing (Escape / backdrop click) while a call is in flight, not only the Cancel
    // button: closing mid POST .../provision and reopening would allow a second Confirm while the first is
    // still running → two real invitations to the same email. Found by adversarial review (2026-10-01).
    // Linking sends an invitation email (outward): Enter never fires it, only the button does.
    <FormDialog
      open
      onOpenChange={(o) => !o && onClose()}
      size="md"
      title={t(esNuevo ? "ehrVincularTitulo" : "ehrEditarTitulo", { nombre })}
      description={
        esNuevo
          ? faltaCorreo
            ? t("ehrFaltaCorreo")
            : t("ehrCorreoAviso", { email: persona.email ?? "" })
          : t("ehrEditarDesc")
      }
      missing={missing}
      blocked={faltaCorreo || loading}
      reason={reason}
      submitting={submitting}
      submittingLabel={t("ehrGuardando")}
      onSubmit={() => {}}
      actions={[{ label: t(esNuevo ? "ehrVincular" : "ehrGuardar"), onClick: () => submit() }]}
    >
      <Field label={t("ehrRol")} htmlFor="ehr-link-role" required>
        <Select value={roleId || undefined} onValueChange={setRoleId}>
          <SelectTrigger id="ehr-link-role" className="w-full">
            <SelectValue placeholder={t("ehrRolPlaceholder")} />
          </SelectTrigger>
          <SelectContent>
            {roles.map((r) => <SelectItem key={r.id} value={r.id}>{r.name}</SelectItem>)}
          </SelectContent>
        </Select>
      </Field>
    </FormDialog>
  );
}
