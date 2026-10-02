"use client";

import * as React from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";

import {
  provisionEhrStaff,
  updateEhrStaffLink,
  listEhrStaffLinks,
  type EhrRole,
  type EhrStaffLink,
} from "@/lib/api/ehr-integration";
import type { Personal } from "@/lib/api/personal";
import { suggestEhrRoleId } from "@/lib/personal/ehr-role-suggestion";
import { toastError } from "@/lib/api/errors";
import { useResource } from "@/hooks/use-resource";
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
  const [busy, setBusy] = React.useState(false);
  const esNuevo = !link;
  const nombre = [persona.name, persona.lastName].filter(Boolean).join(" ").trim() || persona.name;

  // Vincular (crear) necesita un correo real — el EHR invita a ESE correo; editar un rol ya
  // vinculado no lo vuelve a pedir, así que no aplica. Sin esto, "Confirmar" solo se gateaba por
  // `roleId` y un correo vacío mandaba un aviso sin sentido ("se enviará un correo a —") y lo
  // dejaba enviar de todas formas. Encontrado por revisión adversarial (2026-10-01).
  const faltaCorreo = esNuevo && !persona.email;

  async function confirmar() {
    if (busy || !roleId || faltaCorreo || freshRes.state.kind === "loading") return;
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
    // Ignora el cierre (Escape/clic en el fondo) mientras hay una llamada en vuelo — no solo el botón
    // Cancelar: cerrar a mitad de un POST .../provision y volver a abrir reinicia `busy` a false,
    // permitiendo un segundo clic en Confirmar mientras el primero sigue en curso → dos invitaciones
    // reales al mismo correo. Encontrado por revisión adversarial antes de mergear (2026-10-01).
    <Dialog open onOpenChange={(o) => !o && !busy && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{t(esNuevo ? "ehrVincularTitulo" : "ehrEditarTitulo", { nombre })}</DialogTitle>
          <DialogDescription>
            {esNuevo
              ? faltaCorreo
                ? t("ehrFaltaCorreo")
                : t("ehrCorreoAviso", { email: persona.email ?? "" })
              : t("ehrEditarDesc")}
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
          <Button onClick={confirmar} disabled={busy || !roleId || faltaCorreo || freshRes.state.kind === "loading"}>
            {busy ? t("ehrGuardando") : t(esNuevo ? "ehrVincular" : "ehrGuardar")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
