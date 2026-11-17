"use client";

import * as React from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";

import { updateProfile, type Perfil } from "@/lib/api/profiles";
import { toastError } from "@/lib/api/errors";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

/** Edición admin del perfil (D5): nombre, apellido y modo de acceso. */
// El estado inicial viene del perfil; el caller monta con `key={perfil.id}`
// para que abrir otro usuario reinicie el formulario (sin setState en efecto).
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
  const tRoot = useTranslations();
  const [nombre, setNombre] = React.useState(profile?.name ?? "");
  const [apellido, setApellido] = React.useState(profile?.lastName ?? "");
  const [submitting, setSubmitting] = React.useState(false);

  async function onSubmit() {
    if (!profile || !nombre.trim()) return;
    setSubmitting(true);
    try {
      await updateProfile(profile.id, {
        name: nombre.trim(),
        lastName: apellido.trim() || null,
      });
      toast.success(t("guardado"));
      onSaved?.();
      onOpenChange(false);
    } catch (err) {
      toastError(err, tRoot);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{t("title", { email: profile?.email ?? "" })}</DialogTitle>
          <DialogDescription>{t("help")}</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label>{t("nombre")}</Label>
            <Input value={nombre} onChange={(e) => setNombre(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>{t("apellido")}</Label>
            <Input
              value={apellido}
              onChange={(e) => setApellido(e.target.value)}
            />
          </div>
        </div>
        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={submitting}
          >
            {tRoot("common.cancel")}
          </Button>
          <Button onClick={onSubmit} disabled={!nombre.trim() || submitting}>
            {submitting ? tRoot("common.saving") : tRoot("common.save")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
