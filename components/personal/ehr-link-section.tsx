"use client";

import * as React from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";

import {
  provisionEhrStaff,
  updateEhrStaffLink,
  type EhrRole,
  type EhrStaffLink,
} from "@/lib/api/ehr-integration";
import type { Personal } from "@/lib/api/personal";
import { suggestEhrRoleId } from "@/lib/personal/ehr-role-suggestion";
import { toastError } from "@/lib/api/errors";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";

// «Vincular con el EHR»: crear/editar la cuenta del EHR externo para esta persona, con un clic.
// Handoff docs/specs/vincular-personal-con-el-ehr-handoff-fe.md. El botón va en TODA ficha de
// Personal, sin excepción (decisión del dueño, 01-oct-2026) — nunca se gatea por cargo/capacidad.
// Habilitar/deshabilitar NO necesita nada aquí: ya ocurre solo al dar de alta/baja a la persona.

export function EhrLinkSection({
  persona,
  roles,
  link,
  centro,
  onChanged,
}: {
  persona: Personal;
  roles: EhrRole[];
  link: EhrStaffLink | undefined;
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
  link,
  centro,
  onClose,
  onDone,
}: {
  persona: Personal;
  roles: EhrRole[];
  link: EhrStaffLink | undefined;
  centro?: string;
  onClose: () => void;
  onDone: () => void;
}) {
  const t = useTranslations("personalFicha");
  const tRoot = useTranslations();
  const [roleId, setRoleId] = React.useState(() => suggestEhrRoleId(persona.jobTitle, roles) ?? "");
  const [busy, setBusy] = React.useState(false);
  const esNuevo = !link;
  const nombre = [persona.name, persona.lastName].filter(Boolean).join(" ").trim() || persona.name;

  async function confirmar() {
    if (busy || !roleId) return;
    setBusy(true);
    try {
      if (esNuevo) {
        await provisionEhrStaff(persona.id, roleId, centro);
      } else {
        await updateEhrStaffLink(persona.id, { ehrRoleId: roleId }, centro);
      }
      toast.success(t(esNuevo ? "ehrVinculado" : "ehrActualizado"));
      onDone();
    } catch (e) {
      toastError(e, tRoot);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{t(esNuevo ? "ehrVincularTitulo" : "ehrEditarTitulo", { nombre })}</DialogTitle>
          <DialogDescription>
            {esNuevo ? t("ehrCorreoAviso", { email: persona.email || "—" }) : t("ehrEditarDesc")}
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-2">
          <Label>{t("ehrRol")}</Label>
          <Select value={roleId || undefined} onValueChange={setRoleId}>
            <SelectTrigger className="w-full"><SelectValue placeholder={t("ehrRolPlaceholder")} /></SelectTrigger>
            <SelectContent>
              {roles.map((r) => <SelectItem key={r.id} value={r.id}>{r.name}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={busy}>{tRoot("common.cancel")}</Button>
          <Button onClick={confirmar} disabled={busy || !roleId}>
            {busy ? t("ehrGuardando") : t(esNuevo ? "ehrVincular" : "ehrGuardar")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
