"use client";

import * as React from "react";
import { useTranslations } from "next-intl";

import type { CajaDivision, CuadreConItems, ReporteDia } from "@/lib/api/caja";
import { variacion, money } from "@/lib/caja/totales";
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
// (efectivo, electrónicas, total, devoluciones, contado, diferencia) + acciones (abrir/cerrar/
// exportar/imprimir/email). Todos los montos vienen del BE; el FE no recalcula el cierre.
export function ResumenPagos({
  division,
  detalle,
  ventas,
  devoluciones,
  cuadre,
  esHoy,
  canCerrar,
  petty,
  setPetty,
  opening,
  closing,
  emailing,
  onOpen,
  onClose,
  onEmail,
  onExport,
  onPrint,
}: {
  division: CajaDivision;
  detalle: ReporteDia["detalle"];
  ventas: ReporteDia["ventas"];
  devoluciones: ReporteDia["devoluciones"];
  cuadre: CuadreConItems | null;
  esHoy: boolean;
  canCerrar: boolean;
  petty: string;
  setPetty: (v: string) => void;
  opening: boolean;
  closing: boolean;
  emailing: boolean;
  onOpen: () => void;
  onClose: () => void;
  onEmail: (email: string) => void;
  onExport: () => void;
  onPrint: () => void;
}) {
  const t = useTranslations("caja");
  const tp = useTranslations("caja.payments");
  const tRoot = useTranslations();
  const [emailOpen, setEmailOpen] = React.useState(false);
  const [email, setEmail] = React.useState("");

  const cerrado = cuadre?.estado === "cerrado";
  // El "Inicio" (fondo de apertura) es `pettyDeclarado` (confirmado con la fórmula del BE:
  // diferencia = contado − inicio − efectivo de ventas). El efectivo esperado = efectivo de
  // ventas del día (detalle.efectivo.monto), dato del BE — no se recalcula en el cliente.
  const inicio = cerrado
    ? (cuadre?.pettyDeclarado ?? 0)
    : Math.max(0, Number(petty) || 0);
  const inicioEditable = !!cuadre && !cerrado;
  const salesCash = detalle.efectivo.monto;
  const contado = cuadre?.efectivoContado ?? 0;
  const aDepositar = contado - inicio;
  const diff = cerrado
    ? (cuadre?.diferencia ?? 0)
    : variacion(contado, inicio, salesCash);

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
        {inicioEditable ? (
          <div className="flex items-center justify-between gap-2 text-sm">
            <span className="text-muted-foreground">{tp("opening")}</span>
            <Input
              type="number"
              inputMode="decimal"
              min={0}
              step="0.01"
              value={petty}
              onChange={(e) => setPetty(e.target.value)}
              className="h-8 w-28 text-right tabular-nums"
              aria-label={tp("opening")}
            />
          </div>
        ) : (
          <Row label={tp("opening")} value={money(inicio)} />
        )}
        <Row label={tp("salesCash")} value={money(salesCash)} />
        <Row label={tp("electronic")} value={money(detalle.totalElectronicas)} />
        <Row label={tp("totalCards")} value={money(detalle.totalTarjetas)} />
        <Row label={tp("totalCMA")} value={money(detalle.total)} strong />
        <div className="my-1 border-t" />
        <Row label={tp("grossBilling")} value={money(ventas.bruto)} />
        <Row label={tp("returns")} value={money(devoluciones.total)} />
        <Row label={tp("netBilling")} value={money(ventas.neto)} strong />
        {cuadre && (
          <>
            <div className="my-1 border-t" />
            <Row label={tp("cashInDrawer")} value={money(contado)} />
            <Row label={tp("deposit")} value={money(aDepositar)} />
            <div
              className={cn(
                "mt-2 flex items-center justify-between rounded-lg px-3 py-2 text-sm font-semibold",
                diff === 0
                  ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                  : "bg-destructive/10 text-destructive",
              )}
            >
              <span>{t("summary.variance")}</span>
              <span className="tabular-nums">{money(diff)}</span>
            </div>
          </>
        )}
      </section>

      {/* Acciones */}
      <div className="space-y-2">
        {!cuadre ? (
          esHoy ? (
            <div className="space-y-2 rounded-xl border p-4">
              <Label htmlFor="petty">{tp("opening")}</Label>
              <Input
                id="petty"
                type="number"
                inputMode="decimal"
                min={0}
                step="0.01"
                value={petty}
                onChange={(e) => setPetty(e.target.value)}
                className="h-9"
                placeholder="0.00"
              />
              <Button className="w-full" onClick={onOpen} disabled={opening}>
                {t("open")}
              </Button>
            </div>
          ) : (
            <p className="rounded-xl border p-4 text-xs text-muted-foreground">
              {t("historyReadonly")}
            </p>
          )
        ) : (
          <>
            {!cerrado && canCerrar && (
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button className="w-full" disabled={closing}>
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
                    <AlertDialogAction onClick={onClose}>
                      {t("closeConfirmOk")}
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            )}
            {cerrado && cuadre.cerradoEn && (
              <p className="text-xs text-muted-foreground">
                {t("closedAt", { fecha: new Date(cuadre.cerradoEn).toLocaleString() })}
              </p>
            )}
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" size="sm" onClick={onExport}>
                {t("exportExcel")}
              </Button>
              <Button variant="outline" size="sm" onClick={onPrint}>
                {t("print")}
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setEmailOpen((v) => !v)}
              >
                {t("email")}
              </Button>
            </div>
            {emailOpen && (
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
                <Button
                  size="sm"
                  disabled={emailing || !email}
                  onClick={() => onEmail(email)}
                >
                  {t("email")}
                </Button>
              </div>
            )}
          </>
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
