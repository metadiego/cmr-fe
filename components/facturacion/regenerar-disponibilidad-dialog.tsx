"use client";

import * as React from "react";
import { useTranslations } from "next-intl";

import { regenerarDisponibilidad, type RegenerarDisponibilidad } from "@/lib/api/facturas";
import { useSubmit } from "@/components/kit/use-submit";
import { Button } from "@/components/ui/button";
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

// Confirmación + resultado EN PALABRAS de "Regenerar disponibilidad". Fase 1: explica qué hace y pide
// confirmar (acción deliberada y peligrosa). Fase 2: traduce la respuesta del BE a lenguaje humano
// (añadidas / nada faltaba / sugerencias de config), nunca JSON. Idempotente → repetir es inofensivo.
// Confirm-only (no fields): it keeps its own two-phase layout instead of the form shell; useSubmit runs the
// call once at a time and toasts the error, and the dialog cannot be closed while it runs.
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
  const [res, setRes] = React.useState<RegenerarDisponibilidad | null>(null);
  const { submitting: busy, submit: run } = useSubmit(async () => {
    const r = await regenerarDisponibilidad(facturaId, centro);
    setRes(r);
    await onDone?.();
  });

  function handleOpenChange(next: boolean) {
    if (!next && busy) return;
    if (!next) setRes(null);
    onOpenChange(next);
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-md" showCloseButton={!busy}>
        <DialogHeader><DialogTitle>{t("regen.titulo")}</DialogTitle></DialogHeader>
        {res === null ? (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">{t("regen.explica")}</p>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => handleOpenChange(false)} disabled={busy}>{tc("cancel")}</Button>
              <Button onClick={() => run()} disabled={busy}>{busy ? t("regen.ejecutando") : t("regen.confirmar")}</Button>
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
