"use client";

import * as React from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";

import { createPersonal } from "@/lib/api/personal";
import { toastError } from "@/lib/api/errors";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";

// Alta de personal (handoff personal-crud-completo): solo el nombre es obligatorio; el resto (color, cargo,
// sexo, centros…) se completa en la ficha tras crearla. Los CENTROS se asignan en la ficha porque el BE los
// exige por su endpoint propio; aquí se avisa para que no se olvide. Devuelve el id creado para seleccionarlo.
export function NuevoPersonalDialog({
  centro,
  onClose,
  onCreated,
}: {
  centro?: string;
  onClose: () => void;
  onCreated: (id: string) => void;
}) {
  const t = useTranslations("personalFicha");
  const tRoot = useTranslations();
  const [name, setName] = React.useState("");
  const [lastName, setLastName] = React.useState("");
  const [busy, setBusy] = React.useState(false);

  async function crear() {
    if (busy || !name.trim()) return;
    setBusy(true);
    try {
      const creada = await createPersonal({ name: name.trim(), lastName: lastName.trim() || null }, centro);
      toast.success(t("creado"));
      onCreated(creada.id);
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
          <DialogTitle>{t("nuevo")}</DialogTitle>
          <DialogDescription>{t("nuevoAyuda")}</DialogDescription>
        </DialogHeader>
        <div className="grid gap-3">
          <div className="grid gap-1.5">
            <Label htmlFor="np-nombre">{t("nombre")}</Label>
            <Input id="np-nombre" autoFocus value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="np-apellido">{t("apellido")}</Label>
            <Input id="np-apellido" value={lastName} onChange={(e) => setLastName(e.target.value)} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={busy}>{tRoot("common.cancel")}</Button>
          <Button onClick={crear} disabled={busy || !name.trim()}>{busy ? t("guardando") : t("crear")}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
