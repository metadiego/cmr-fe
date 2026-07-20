"use client";

import * as React from "react";
import { useTranslations } from "next-intl";

import type { CuadreConItems } from "@/lib/api/caja";
import { efectivoEsperado, variacion, money } from "@/lib/caja/totales";
import { formaPagoLabel } from "@/lib/facturacion/forma-pago-label";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

// Panel "esperado vs contado" (UI 2026, sticky estilo order-summary): totales por método (BE),
// efectivo esperado, caja chica, efectivo contado y DIFERENCIA resaltada por signo. El cálculo del
// esperado usa datos del BE (porMetodo + claves esEfectivo); el cierre real lo sella el BE.
export function ResumenEsperado({
  cuadre,
  porMetodo,
  clavesEfectivo,
  canClose,
  closing,
  onClose,
}: {
  cuadre: CuadreConItems;
  porMetodo: Record<string, number>;
  clavesEfectivo: string[];
  canClose: boolean;
  closing: boolean;
  onClose: () => void;
}) {
  const t = useTranslations("caja.summary");
  const tc = useTranslations("caja");
  const tRoot = useTranslations();
  const cerrado = cuadre.estado === "cerrado";

  // Cerrado → usa el snapshot sellado por el BE; abierto → provisional desde el reporte en vivo.
  const metodos = cerrado ? (cuadre.totalesPorMetodo ?? {}) : porMetodo;
  const esperado = cerrado
    ? cuadre.efectivoEsperado
    : efectivoEsperado(porMetodo, clavesEfectivo);
  const contado = cuadre.efectivoContado;
  const petty = cuadre.pettyDeclarado;
  const diff = cerrado
    ? cuadre.diferencia
    : variacion(contado, petty, esperado);

  const entradas = Object.entries(metodos).filter(([, v]) => v !== 0);

  return (
    <div className="space-y-4 rounded-xl border p-4 lg:sticky lg:top-20">
      <h3 className="text-sm font-semibold">{t("title")}</h3>

      <div className="space-y-1">
        <p className="text-xs font-medium text-muted-foreground">
          {t("byMethod")}
        </p>
        {entradas.length === 0 ? (
          <p className="text-sm text-muted-foreground">—</p>
        ) : (
          <ul className="space-y-0.5">
            {entradas.map(([clave, monto]) => (
              <li
                key={clave}
                className="flex items-center justify-between text-sm"
              >
                <span>{formaPagoLabel(tRoot, clave)}</span>
                <span className="tabular-nums">{money(monto)}</span>
              </li>
            ))}
          </ul>
        )}
      </div>

      <dl className="space-y-1 border-t pt-3 text-sm">
        <Row label={t("expected")} value={money(esperado)} />
        <Row label={t("petty")} value={money(petty)} />
        <Row label={t("counted")} value={money(contado)} strong />
      </dl>

      <div
        className={cn(
          "flex items-center justify-between rounded-lg px-3 py-2 text-sm font-semibold",
          diff === 0
            ? "bg-muted text-foreground"
            : diff > 0
              ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
              : "bg-destructive/10 text-destructive",
        )}
      >
        <span>
          {t("variance")}
          {diff !== 0 && (
            <span className="ml-1 font-normal">
              ({diff > 0 ? t("over") : t("short")})
            </span>
          )}
          {diff === 0 && <span className="ml-1 font-normal">({t("ok")})</span>}
        </span>
        <span className="tabular-nums">{money(diff)}</span>
      </div>

      {cerrado ? (
        cuadre.cerradoEn && (
          <p className="text-xs text-muted-foreground">
            {tc("closedAt", {
              fecha: new Date(cuadre.cerradoEn).toLocaleString(),
            })}
          </p>
        )
      ) : canClose ? (
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button className="w-full" disabled={closing}>
              {tc("close")}
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>{tc("closeConfirmTitle")}</AlertDialogTitle>
              <AlertDialogDescription>
                {tc("closeConfirmBody")}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>{tRoot("common.cancel")}</AlertDialogCancel>
              <AlertDialogAction onClick={onClose}>
                {tc("closeConfirmOk")}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      ) : null}
    </div>
  );
}

function Row({
  label,
  value,
  strong,
}: {
  label: string;
  value: string;
  strong?: boolean;
}) {
  return (
    <div className="flex items-center justify-between">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className={cn("tabular-nums", strong && "font-semibold")}>{value}</dd>
    </div>
  );
}
