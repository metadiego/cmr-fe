"use client";

import { useTranslations } from "next-intl";

import { notificarPanel } from "@/lib/api/paneles";
import { useSubmit } from "@/components/kit/use-submit";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

// Bell modal (fd_notificar column). Sends the notice to the panel (data-driven: panel/section come from
// the column render) and, optionally, assigns the nurse without notifying (reuses the fd_enfermera select).
// No fields to fill: one action button, so it keeps its own layout and only uses useSubmit.
export function PanelNotificarModal({
  open,
  onOpenChange,
  panelClave,
  seccion,
  sesionId,
  citaId,
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
  // Uno de los dos, según la entidad del tablero: sesión en frontdesk, cita en Atención.
  sesionId?: string;
  citaId?: string;
  servicioNombre: string;
  pacienteNombre: string;
  enfermeras: { value: string; label: string }[];
  enfermeraActual?: string;
  onAsignarEnfermera?: (personalId: string) => void;
  centro?: string;
}) {
  const t = useTranslations("frontdesk");
  const { submitting: enviando, submit: notificar } = useSubmit(
    () =>
      notificarPanel(
        panelClave,
        citaId ? { seccion, appointmentId: citaId } : { seccion, sessionId: sesionId },
        centro,
      ),
    { successMessage: t("notificado"), onSuccess: () => onOpenChange(false) },
  );

  // No closing while the notice is being sent (Esc, outside click, X).
  return (
    <Dialog open={open} onOpenChange={(o) => (o || !enviando) && onOpenChange(o)}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>{servicioNombre}</DialogTitle>
          <DialogDescription>{pacienteNombre}</DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <Button size="lg" className="h-14 w-full text-base" onClick={() => notificar()} disabled={enviando}>
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
