"use client";

import * as React from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";

import { cambiarEmailPerfil, type Perfil } from "@/lib/api/profiles";
import { apiErrorMessage } from "@/lib/api/errors";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

// Cambiar el email de ACCESO de un perfil (admin/super_admin, permiso profiles.email). Acción aparte del
// formulario de la ficha, CON confirmación: mueve el correo en Supabase + nuestra tabla, cierra las
// sesiones abiertas de esa persona y actualiza su ficha de personal. No cambia la contraseña.
// Handoff cambiar-email-de-perfil-handoff-be.
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function CambiarEmailDialog({
  perfil,
  onClose,
  onSaved,
}: {
  perfil: Perfil | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const t = useTranslations("admin.users.email");
  const [email, setEmail] = React.useState("");
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  // Reset al abrir con otro perfil (precarga el correo actual como punto de partida).
  const [lastId, setLastId] = React.useState<string | null>(null);
  if (perfil && perfil.id !== lastId) {
    setLastId(perfil.id);
    setEmail(perfil.email ?? "");
    setError(null);
  }

  const nuevo = email.trim().toLowerCase();
  const invalido = !EMAIL_RE.test(nuevo);
  const sinCambio = !!perfil && nuevo === (perfil.email ?? "").trim().toLowerCase();

  async function guardar() {
    if (!perfil || invalido || saving) return;
    setSaving(true);
    setError(null);
    try {
      await cambiarEmailPerfil(perfil.id, nuevo);
      toast.success(t("ok"));
      onSaved();
      onClose();
    } catch (e) {
      // 409 (email ya usado / correo reservado del master / perfil master) → mensaje del BE tal cual.
      setError(apiErrorMessage(e));
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={perfil != null} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{t("titulo")}</DialogTitle>
          <DialogDescription>
            {t("desc", { nombre: perfil ? [perfil.name, perfil.lastName].filter(Boolean).join(" ") : "" })}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <label className="flex flex-col gap-1.5">
            <span className="text-xs font-medium text-muted-foreground">{t("label")}</span>
            <Input
              type="email"
              value={email}
              onChange={(e) => { setEmail(e.target.value); setError(null); }}
              placeholder={t("placeholder")}
              disabled={saving}
              autoFocus
              onKeyDown={(e) => { if (e.key === "Enter") guardar(); }}
            />
            {email.trim() !== "" && invalido && (
              <span className="text-xs text-destructive">{t("invalido")}</span>
            )}
          </label>
          <p className="rounded-lg bg-warning px-3 py-2 text-xs text-warning-foreground">
            {t("aviso")}
          </p>
          {error && (
            <p className="rounded-lg bg-destructive/10 px-3 py-2 text-xs font-medium text-destructive">{error}</p>
          )}
          <div className="flex justify-end gap-2">
            <Button variant="outline" size="sm" onClick={onClose} disabled={saving}>{t("cancelar")}</Button>
            <Button size="sm" onClick={guardar} disabled={invalido || sinCambio || saving}>
              {saving ? t("guardando") : t("guardar")}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
