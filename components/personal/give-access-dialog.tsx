"use client";

import * as React from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";

import type { Personal } from "@/lib/api/personal";
import type { Rol } from "@/lib/api/rbac";
import { inviteUser } from "@/lib/api/profiles";
import { toastError } from "@/lib/api/errors";
import { staffFullName as nombreDe } from "@/lib/personal/staff-name";
import { Button } from "@/components/ui/button";
import { EmailInput } from "@/components/email-input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";

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
  const tRoot = useTranslations();
  const [email, setEmail] = React.useState(persona.email ?? "");
  const [rolClave, setRolClave] = React.useState("");
  const [busy, setBusy] = React.useState(false);

  async function dar() {
    if (busy || !email.trim() || !rolClave) return;
    setBusy(true);
    try {
      // UNA sola llamada: crea la cuenta, la enlaza a la ficha (personalId), da el rol y asigna el centro.
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
      toast.success(t("accesoDado", { nombre: nombreDe(persona) }));
      onDone();
    } catch (e) {
      // PERSONAL_YA_TIENE_CUENTA / PERSONAL_DE_OTRO_CENTRO / PERSONAL_NO_EXISTE → mensaje del BE (labelKey).
      toastError(e, tRoot);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{t("darAccesoTitulo", { nombre: nombreDe(persona) })}</DialogTitle>
          <DialogDescription>{t("darAccesoDesc")}</DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="grid gap-2">
            <Label>{t("correo")}</Label>
            <EmailInput value={email} onValueChange={setEmail} placeholder="persona@correo.com" />
          </div>
          <div className="grid gap-2">
            <Label>{t("rol")}</Label>
            <Select value={rolClave || undefined} onValueChange={setRolClave}>
              <SelectTrigger className="w-full"><SelectValue placeholder={t("rolPlaceholder")} /></SelectTrigger>
              <SelectContent>
                {roles.map((r) => <SelectItem key={r.id} value={r.slug}>{r.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={busy}>{tRoot("common.cancel")}</Button>
          <Button onClick={dar} disabled={busy || !email.trim() || !rolClave}>{busy ? t("dando") : t("darAcceso")}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
