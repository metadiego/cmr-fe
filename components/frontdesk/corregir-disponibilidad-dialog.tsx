"use client";

import * as React from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";

import { ajustarDisponibilidad, paqueteTotales, type PaqueteDisponibilidad } from "@/lib/api/frontdesk";
import { legendMultiplicadores } from "@/lib/frontdesk/multiplicadores";
import { toastError } from "@/lib/api/errors";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

// Modal "Corregir disponibilidad" (GAP C) — PATCH …/paquetes/:id/ajuste. Corrige sesiones cuando
// facturación se equivocó; actualiza el saldo (no reescribe la factura). RBAC: quien lo abre ya pasó el
// gate `frontdesk.disponibilidad.editar`. Extraído de frontdesk-board.tsx (techo de tamaño).
export function CorregirDisponibilidadDialog({
  paquete,
  centro,
  onClose,
  onDone,
}: {
  paquete: PaqueteDisponibilidad | null; // null = cerrado (diálogo controlado por el padre)
  centro?: string;
  onClose: () => void;
  onDone: () => void;
}) {
  const t = useTranslations("frontdesk");
  const { entregadas, totales } = paquete ? paqueteTotales(paquete) : { entregadas: 0, totales: 0 };
  const [valor, setValor] = React.useState<string>("");
  const [guardando, setGuardando] = React.useState(false);
  // Reinicia el input al abrir/cambiar de paquete (patrón "ajustar estado en render", sin efecto).
  const pid = paquete?.id ?? null;
  const [prevPid, setPrevPid] = React.useState<string | null>(null);
  if (pid !== prevPid) {
    setPrevPid(pid);
    setValor(paquete ? String(totales) : "");
  }
  const n = Number(valor);
  const invalido = !Number.isFinite(n) || n < entregadas;
  async function guardar() {
    if (invalido || !paquete?.id) return;
    setGuardando(true);
    try {
      await ajustarDisponibilidad(paquete.id, { totalSessions: n }, centro);
      toast.success(t("corregirOk"));
      onClose();
      onDone();
    } catch (e) {
      toastError(e, t);
    } finally {
      setGuardando(false);
    }
  }
  return (
    <Dialog open={paquete != null} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>{t("corregirTitulo")}</DialogTitle>
          <DialogDescription>{t("corregirDesc")}</DialogDescription>
        </DialogHeader>
        {paquete && (
          <div className="space-y-3">
            <div className="rounded-md bg-card px-3 py-2 text-sm ring-1 ring-foreground/10 shadow-sm shadow-[rgba(16,32,64,0.06)]">
              <span className="font-medium">{paquete.productoNombre ?? paquete.sku ?? "—"}</span>
              {paquete.multiplicadores && (
                <span className="ml-2 text-muted-foreground">
                  {legendMultiplicadores(paquete.multiplicadores, (k) => (t.has(`mult.${k}`) ? t(`mult.${k}`) : k))}
                </span>
              )}
            </div>
            <div className="space-y-1">
              <Label htmlFor="corregir-sesiones">{t("corregirSesiones")}</Label>
              <Input
                id="corregir-sesiones"
                type="number"
                min={entregadas}
                value={valor}
                onChange={(e) => setValor(e.target.value)}
              />
              {invalido && <p className="text-xs text-destructive">{t("corregirMenorConsumido", { n: entregadas })}</p>}
            </div>
            <div className="flex justify-end">
              <Button onClick={guardar} disabled={invalido || guardando || !paquete.id}>
                {t("corregirGuardar")}
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
