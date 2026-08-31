"use client";

import * as React from "react";
import { useTranslations } from "next-intl";

import type { CajaDivision, ReporteDia } from "@/lib/api/caja";
import { money } from "@/lib/caja/totales";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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

// Panel derecho "Resumen de pagos" (UI 2026, sticky): tarjetas / otros medios / resumen general
// (modelo CMA: inicio, efectivo de ventas, electrónicas, total tarjetas, total del día, fact.
// bruta/neta, efectivo contado, a depositar, diferencia) + acciones. Solo PRESENTA datos del BE.
export function ResumenPagos({
  division,
  detalle,
  subtotalesTarjeta,
  ventas,
  devoluciones,
  inicio,
  salesCash,
  contado,
  aDepositar,
  diferencia,
  cerrado,
  cerradoEn,
  canProcesar,
  procesando,
  onProcesar,
  onExport,
  canEmail,
  emailing,
  onEmail,
}: {
  division: CajaDivision;
  detalle: ReporteDia["detalle"];
  subtotalesTarjeta: Array<{ clave: string; labelKey: string; nombre: string; monto: number }>;
  ventas: ReporteDia["ventas"];
  devoluciones: ReporteDia["devoluciones"];
  inicio: number;
  salesCash: number;
  contado: number;
  aDepositar: number;
  diferencia: number;
  cerrado: boolean;
  cerradoEn: string | null;
  canProcesar: boolean;
  procesando: boolean;
  onProcesar: () => void;
  onExport: () => void;
  canEmail: boolean;
  emailing: boolean;
  onEmail: (email: string) => void;
}) {
  const t = useTranslations("caja");
  const tp = useTranslations("caja.payments");
  const tRoot = useTranslations();
  const [emailOpen, setEmailOpen] = React.useState(false);
  const [email, setEmail] = React.useState("");

  // Estado del cuadre (etiqueta legacy): 0 = cuadra, < 0 = falta, > 0 = sobra.
  const estado =
    Math.abs(diferencia) < 0.01 ? "ok" : diferencia < 0 ? "short" : "over";

  return (
    <div className="space-y-4 lg:sticky lg:top-20">
      {/* Tarjetas */}
      <section className="rounded-xl border">
        <h3 className="border-b px-4 py-2.5 text-sm font-semibold">{tp("cards")}</h3>
        {detalle.tarjetas.length === 0 ? (
          <p className="px-4 py-3 text-sm text-muted-foreground">{tp("noOther")}</p>
        ) : (
          <ul className="divide-y">
            {detalle.tarjetas.map((row) => (
              <li key={row.clave} className="flex items-center justify-between px-4 py-2 text-sm">
                <span>
                  {row.nombre}
                  <span className="ml-1 text-xs text-muted-foreground">×{row.cantidad}</span>
                </span>
                <span className="tabular-nums">{money(row.monto)}</span>
              </li>
            ))}
          </ul>
        )}
        {/* Subtotales informativos configurables (p.ej. VISA + MASTERCARD), del BE. */}
        {subtotalesTarjeta.map((s) => (
          <div
            key={s.clave}
            className="flex items-center justify-between px-4 py-1.5 text-xs italic text-muted-foreground"
          >
            <span>{tRoot.has(s.labelKey) ? tRoot(s.labelKey) : s.nombre}</span>
            <span className="tabular-nums">{money(s.monto)}</span>
          </div>
        ))}
        <div className="flex items-center justify-between border-t px-4 py-2.5 text-sm font-semibold">
          <span>{tp("totalCards")}</span>
          <span className="tabular-nums">{money(detalle.totalTarjetas)}</span>
        </div>
      </section>

      {/* Otros medios */}
      <section className="rounded-xl border">
        <h3 className="border-b px-4 py-2.5 text-sm font-semibold">{tp("otherMethods")}</h3>
        {detalle.otros.length === 0 ? (
          <p className="px-4 py-3 text-sm text-muted-foreground">{tp("noOther")}</p>
        ) : (
          <ul className="divide-y">
            {detalle.otros.map((row) => (
              <li key={row.clave} className="flex items-center justify-between px-4 py-2 text-sm">
                <span>
                  {row.nombre}
                  <span className="ml-1 text-xs text-muted-foreground">×{row.cantidad}</span>
                </span>
                <span className="tabular-nums">{money(row.monto)}</span>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* Resumen general (modelo CMA) */}
      <section className="space-y-1 rounded-xl border p-4">
        <h3 className="mb-2 text-sm font-semibold">{tp("general")}</h3>
        <Row label={tp("opening")} value={money(inicio)} />
        <Row label={tp("salesCash")} value={money(salesCash)} />
        <Row label={tp("electronic")} value={money(detalle.totalElectronicas)} />
        <Row label={tp("totalCards")} value={money(detalle.totalTarjetas)} />
        <Row label={tp("totalCMA")} value={money(detalle.total)} strong />
        <div className="my-1 border-t" />
        <Row label={tp("grossBilling")} value={money(ventas.bruto)} />
        <Row label={tp("returns")} value={money(devoluciones.total)} />
        <Row label={tp("netBilling")} value={money(ventas.neto)} strong />
        <div className="my-1 border-t" />
        <Row label={tp("cashInDrawer")} value={money(contado)} />
        <Row label={tp("deposit")} value={money(aDepositar)} />
        <div
          className={cn(
            "mt-2 flex items-center justify-between rounded-lg px-3 py-2 text-sm font-semibold",
            estado === "ok"
              ? "bg-success text-success-foreground"
              : estado === "over"
                ? "bg-warning text-warning-foreground"
                : "bg-destructive/10 text-destructive",
          )}
        >
          <span>
            {t("summary.variance")}
            <span className="ml-1 font-normal">({tp(`status.${estado}`)})</span>
          </span>
          <span className="tabular-nums">{money(diferencia)}</span>
        </div>
      </section>

      {/* Acciones */}
      <div className="space-y-2">
        {cerrado && cerradoEn && (
          <p className="text-xs text-muted-foreground">
            {t("closedAt", { fecha: new Date(cerradoEn).toLocaleString() })}
          </p>
        )}
        {canProcesar && (
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button className="w-full" disabled={procesando}>
                {t("processClose")}
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>{t("closeConfirmTitle")}</AlertDialogTitle>
                <AlertDialogDescription>{t("closeConfirmBody")}</AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>{tRoot("common.cancel")}</AlertDialogCancel>
                <AlertDialogAction onClick={onProcesar}>{t("closeConfirmOk")}</AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        )}
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" size="sm" onClick={onExport}>
            {t("exportExcel")}
          </Button>
          {canEmail && (
            <Button variant="outline" size="sm" onClick={() => setEmailOpen((v) => !v)}>
              {t("email")}
            </Button>
          )}
        </div>
        {emailOpen && canEmail && (
          <div className="flex items-end gap-2 rounded-lg border p-3">
            <div className="flex-1 space-y-1">
              <Label htmlFor="caja-email" className="text-xs">
                {t("emailPrompt")}
              </Label>
              <Input
                id="caja-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="h-9"
                placeholder="correo@ejemplo.com"
              />
            </div>
            <Button size="sm" disabled={emailing || !email} onClick={() => onEmail(email)}>
              {t("email")}
            </Button>
          </div>
        )}
      </div>

      <p className="text-right text-[11px] uppercase tracking-wide text-muted-foreground">
        {t(`division.${division}`)}
      </p>
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
    <div className="flex items-center justify-between text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span className={cn("tabular-nums", strong && "font-semibold")}>{value}</span>
    </div>
  );
}
