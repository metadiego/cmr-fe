"use client";

import * as React from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";

import { notificarPanel } from "@/lib/api/paneles";
import { toastError } from "@/lib/api/errors";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

// Modal de la CAMPANA (columna fd_notificar). Manda el aviso al panel (data-driven: panel/sección vienen
// del render de la columna) y, opcional, asigna la enfermera sin avisar (reusa el select fd_enfermera).
export function PanelNotificarModal({
  open,
  onOpenChange,
  panelClave,
  seccion,
  sesionId,
  servicioNombre,
  pacienteNombre,
  enfermeras,
  enfermeraActual,
  onAsignarEnfermera,
  centro,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  panelClave: string;
  seccion: string;
  sesionId: string;
  servicioNombre: string;
  pacienteNombre: string;
  enfermeras: { value: string; label: string }[];
  enfermeraActual?: string;
  onAsignarEnfermera?: (personalId: string) => void;
  centro?: string;
}) {
  const t = useTranslations("frontdesk");
  const [enviando, setEnviando] = React.useState(false);

  async function notificar() {
    setEnviando(true);
    try {
      await notificarPanel(panelClave, { seccion, sesionId }, centro);
      toast.success(t("notificado"));
      onOpenChange(false);
    } catch (e) {
      toastError(e, t);
    } finally {
      setEnviando(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>{servicioNombre}</DialogTitle>
          <DialogDescription>{pacienteNombre}</DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <Button size="lg" className="h-14 w-full text-base" onClick={notificar} disabled={enviando}>
            {enviando ? t("notificando") : t("notificarAlPanel")}
          </Button>
          {enfermeras.length > 0 && onAsignarEnfermera && (
            <div className="space-y-1.5">
              <span className="text-xs font-medium text-muted-foreground">{t("seleccionarEnfermera")}</span>
              <Select value={enfermeraActual ?? ""} onValueChange={(v) => onAsignarEnfermera(v)}>
                <SelectTrigger className="w-full"><SelectValue placeholder={t("seleccionarEnfermera")} /></SelectTrigger>
                <SelectContent>
                  {enfermeras.map((e) => <SelectItem key={e.value} value={e.value}>{e.label}</SelectItem>)}
                </SelectContent>
              </Select>
              <p className="text-[11px] text-muted-foreground">{t("asignarSinAvisar")}</p>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
