"use client";

import * as React from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { HugeiconsIcon } from "@hugeicons/react";
import { Copy01Icon, CheckmarkCircle02Icon } from "@hugeicons/core-free-icons";

import type { CodigoAccesoResult } from "@/lib/api/profiles";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

// Muestra el código de acceso recién generado para entregarlo al usuario (en persona/teléfono/WhatsApp).
// Es una CREDENCIAL TEMPORAL: se muestra solo mientras el diálogo está abierto, NO se guarda en storage
// ni se registra en logs/analítica. Handoff codigo-de-acceso.
export function CodigoAccesoDialog({
  codigo,
  onClose,
}: {
  codigo: CodigoAccesoResult | null;
  onClose: () => void;
}) {
  const t = useTranslations("admin.users.codigo");
  const [copiado, setCopiado] = React.useState(false);

  async function copiar() {
    if (!codigo) return;
    try {
      await navigator.clipboard.writeText(codigo.codigo);
      setCopiado(true);
      setTimeout(() => setCopiado(false), 1500);
    } catch {
      toast.error(t("copiarError"));
    }
  }

  return (
    <Dialog open={codigo != null} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{t("titulo")}</DialogTitle>
          <DialogDescription>{t("desc", { email: codigo?.email ?? "" })}</DialogDescription>
        </DialogHeader>
        {codigo && (
          <div className="space-y-3">
            <div className="flex items-center justify-between gap-3 rounded-md bg-card px-4 py-3 shadow-sm shadow-[rgba(16,32,64,0.06)] ring-1 ring-foreground/10">
              <span className="select-all font-mono text-2xl font-bold tracking-[0.2em]">{codigo.codigo}</span>
              <Button variant="outline" size="sm" onClick={copiar}>
                <HugeiconsIcon icon={copiado ? CheckmarkCircle02Icon : Copy01Icon} className="size-4" />
                {copiado ? t("copiado") : t("copiar")}
              </Button>
            </div>
            <p className="rounded-lg bg-warning px-3 py-2 text-xs text-warning-foreground">
              {t("aviso", { min: codigo.expiraEnMinutos })}
            </p>
            <p className="text-xs text-muted-foreground">{t("comoUsar")}</p>
            <div className="flex justify-end">
              <Button onClick={onClose}>{t("listo")}</Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
