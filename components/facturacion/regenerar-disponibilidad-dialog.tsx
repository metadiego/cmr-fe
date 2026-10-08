"use client";

import * as React from "react";
import { useTranslations } from "next-intl";

import { regenerarDisponibilidad, type RegenerarDisponibilidad } from "@/lib/api/facturas";
import { toastError } from "@/lib/api/errors";
import { Button } from "@/components/ui/button";
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

// Confirmación + resultado EN PALABRAS de "Regenerar disponibilidad". Fase 1: explica qué hace y pide
// confirmar (acción deliberada y peligrosa). Fase 2: traduce la respuesta del BE a lenguaje humano
// (añadidas / nada faltaba / sugerencias de config), nunca JSON. Idempotente → repetir es inofensivo.
export function RegenerarDisponibilidadDialog({
  open,
  onOpenChange,
  facturaId,
  centro,
  onDone,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  facturaId: string;
  centro?: string;
  onDone?: () => void | Promise<unknown>;
}) {
  const t = useTranslations("facturacion");
  const tc = useTranslations("common");
  const tRoot = useTranslations();
  const [busy, setBusy] = React.useState(false);
  const [res, setRes] = React.useState<RegenerarDisponibilidad | null>(null);

  function handleOpenChange(next: boolean) {
    if (!next) { setRes(null); setBusy(false); }
    onOpenChange(next);
  }
  async function run() {
    setBusy(true);
    try {
      const r = await regenerarDisponibilidad(facturaId, centro);
      setRes(r);
      await onDone?.();
    } catch (err) {
      toastError(err, tRoot);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader><DialogTitle>{t("regen.titulo")}</DialogTitle></DialogHeader>
        {res === null ? (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">{t("regen.explica")}</p>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => handleOpenChange(false)}>{tc("cancel")}</Button>
              <Button onClick={run} disabled={busy}>{busy ? t("regen.ejecutando") : t("regen.confirmar")}</Button>
            </div>
          </div>
        ) : (
          <div className="space-y-3 text-sm">
            {res.creados > 0 ? (
              <Alert variant="success">
                <AlertTitle>{t("regen.creados", { n: res.creados })}</AlertTitle>
                <AlertDescription>
                  <ul className="list-disc pl-5">
                    {res.detalle.map((d, i) => (
                      <li key={i}>{t("regen.linea", { sesiones: d.sessions ?? 0, sku: d.sku ?? "—" })}</li>
                    ))}
                  </ul>
                </AlertDescription>
              </Alert>
            ) : (
              <p className="rounded-md border bg-muted/40 px-3 py-2 text-muted-foreground">{t("regen.nada")}</p>
            )}
            {!!res.sugerencias?.length && (
              <Alert variant="warning">
                <AlertTitle>{t("regen.sugerenciasTitulo")}</AlertTitle>
                <AlertDescription>
                  <ul className="list-disc pl-5">
                    {res.sugerencias.map((s, i) => (
                      <li key={i}>{t("regen.sugerencia", { sku: s.sku ?? "—" })}</li>
                    ))}
                  </ul>
                </AlertDescription>
              </Alert>
            )}
            <div className="flex justify-end">
              <Button onClick={() => handleOpenChange(false)}>{t("regen.listo")}</Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
