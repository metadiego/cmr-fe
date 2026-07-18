"use client";

import * as React from "react";
import { useTranslations, useLocale } from "next-intl";

import { repararPago, anularPago, type FacturaPago, type FormaPago } from "@/lib/api/facturas";
import { useCan } from "@/hooks/use-can";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { HugeiconsIcon } from "@hugeicons/react";
import { Edit02Icon, Delete02Icon, Tick02Icon, Cancel01Icon } from "@hugeicons/core-free-icons";

const n = (v: unknown) => Number(v ?? 0);
const money = (v: unknown) => `$${n(v).toFixed(2)}`;

function fmtFecha(v: unknown, locale: string): string {
  if (v == null || v === "") return "";
  const d = new Date(String(v));
  return Number.isNaN(d.getTime())
    ? ""
    : new Intl.DateTimeFormat(locale === "en" ? "en-US" : "es-PR", {
        month: "2-digit", day: "2-digit", year: "numeric", timeZone: "America/Puerto_Rico",
      }).format(d);
}

// Bloque de PAGOS de una factura emitida. Dos modos DISTINTOS y explícitos (evita errores):
//   VER  → lista de solo lectura de cada forma usada (pago / reembolso), monto y fecha.
//   EDITAR → corrige la forma/monto de cada pago o reembolso (append-only, auditable) o lo anula.
// El reembolso de una devolución es un pago tipo=reembolso: el MISMO PUT cambia su forma (pagó tarjeta
// → reembolsa cheque). Gate RBAC `factura.pago.anular`. Handoff fe-editar-formas-de-pago (#112).
export function PagosFactura({
  pagos,
  formas,
  id,
  centro,
  busy,
  run,
}: {
  pagos: FacturaPago[];
  formas: FormaPago[];
  id: string;
  centro?: string;
  busy: boolean;
  run: (fn: () => Promise<unknown>) => Promise<void>;
}) {
  const t = useTranslations("pagosFactura");
  const locale = useLocale();
  const { can } = useCan();
  const [editar, setEditar] = React.useState(false);
  const puedeEditar = can("factura.pago.anular");

  if (!pagos || pagos.length === 0) return null;

  return (
    <div className="space-y-2 rounded-xl border p-4">
      <div className="flex items-center justify-between">
        <span className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
          {editar ? t("editTitle") : t("title")}
        </span>
        {puedeEditar &&
          (editar ? (
            <Button variant="ghost" size="sm" className="h-7 gap-1 px-2 text-xs" disabled={busy} onClick={() => setEditar(false)}>
              <HugeiconsIcon icon={Cancel01Icon} className="size-3.5" />
              {t("done")}
            </Button>
          ) : (
            <Button variant="ghost" size="sm" className="h-7 gap-1 px-2 text-xs" onClick={() => setEditar(true)}>
              <HugeiconsIcon icon={Edit02Icon} className="size-3.5" />
              {t("edit")}
            </Button>
          ))}
      </div>

      {editar && (
        <p className="rounded-lg bg-amber-500/10 px-2.5 py-1.5 text-[11px] leading-snug text-amber-700 dark:text-amber-400">
          {t("editHint")}
        </p>
      )}

      <ul className="space-y-1.5">
        {pagos.map((p) =>
          editar ? (
            <PagoEditRow key={p.id} pago={p} formas={formas} id={id} centro={centro} busy={busy} run={run} />
          ) : (
            <PagoViewRow key={p.id} pago={p} locale={locale} />
          ),
        )}
      </ul>
    </div>
  );
}

function TipoBadge({ tipo }: { tipo?: string }) {
  const t = useTranslations("pagosFactura");
  const esReembolso = tipo === "reembolso";
  return (
    <span
      className={
        "rounded-full px-1.5 py-0.5 text-[10px] font-semibold " +
        (esReembolso ? "bg-destructive/15 text-destructive" : "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400")
      }
    >
      {esReembolso ? t("refund") : t("payment")}
    </span>
  );
}

function PagoViewRow({ pago, locale }: { pago: FacturaPago; locale: string }) {
  const esReembolso = pago.tipo === "reembolso";
  const fecha = fmtFecha(pago.fecha, locale);
  return (
    <li className="flex items-center justify-between gap-2 rounded-lg bg-muted/30 px-2.5 py-1.5 text-sm">
      <span className="flex min-w-0 items-center gap-1.5">
        <TipoBadge tipo={pago.tipo} />
        <span className="truncate font-medium">{pago.formaPagoNombre ?? "—"}</span>
        {pago.referencia && <span className="truncate text-xs text-muted-foreground">{pago.referencia}</span>}
        {fecha && <span className="hidden text-xs text-muted-foreground sm:inline">· {fecha}</span>}
      </span>
      <span className={"shrink-0 tabular-nums font-medium " + (esReembolso ? "text-destructive" : "")}>
        {esReembolso ? "−" : ""}{money(pago.monto)}
      </span>
    </li>
  );
}

// Fila EDITAR: cambiar forma (y monto) en 1-2 clics → aparece "Guardar" solo si hay cambios. Anular con
// confirmación. Preserva el tipo (un reembolso sigue siendo reembolso). motivo obligatorio (auditable).
function PagoEditRow({
  pago,
  formas,
  id,
  centro,
  busy,
  run,
}: {
  pago: FacturaPago;
  formas: FormaPago[];
  id: string;
  centro?: string;
  busy: boolean;
  run: (fn: () => Promise<unknown>) => Promise<void>;
}) {
  const t = useTranslations("pagosFactura");
  const tRoot = useTranslations();
  const [formaId, setFormaId] = React.useState(pago.formaPagoId ?? "");
  const [monto, setMonto] = React.useState(String(n(pago.monto).toFixed(2)));
  const [confirmAnular, setConfirmAnular] = React.useState(false);
  const [motivoAnular, setMotivoAnular] = React.useState("");

  const cambio = formaId !== (pago.formaPagoId ?? "") || n(monto) !== n(pago.monto);
  const valido = !!formaId && n(monto) > 0;

  function guardar() {
    if (!pago.id || !cambio || !valido || busy) return;
    run(() =>
      repararPago(
        id,
        pago.id!,
        { formaPagoId: formaId, monto: n(monto), motivo: t("motivoCorreccion") },
        centro,
      ),
    );
  }

  function anular() {
    if (!pago.id || busy) return;
    run(() => anularPago(id, pago.id!, motivoAnular.trim() || t("motivoAnulacion"), centro)).then(() =>
      setConfirmAnular(false),
    );
  }

  return (
    <li className="space-y-1.5 rounded-lg border px-2.5 py-2">
      <div className="flex items-center gap-1.5">
        <TipoBadge tipo={pago.tipo} />
        <Select value={formaId} onValueChange={setFormaId}>
          <SelectTrigger size="sm" className="h-8 flex-1"><SelectValue placeholder={t("method")} /></SelectTrigger>
          <SelectContent>
            {formas.filter((f) => f.activo !== false).map((f) => (
              <SelectItem key={f.id} value={f.id}>{f.nombre}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="flex items-center gap-1.5">
        <Input
          value={monto}
          onChange={(e) => setMonto(e.target.value)}
          inputMode="decimal"
          className="h-8 flex-1 text-right tabular-nums"
          aria-label={t("amount")}
        />
        <Button type="button" size="sm" className="h-8 gap-1 px-2" disabled={!cambio || !valido || busy} onClick={guardar}>
          <HugeiconsIcon icon={Tick02Icon} className="size-3.5" />
          {t("save")}
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="size-8 text-destructive"
          disabled={busy}
          aria-label={t("void")}
          onClick={() => setConfirmAnular(true)}
        >
          <HugeiconsIcon icon={Delete02Icon} className="size-4" />
        </Button>
      </div>

      <AlertDialog open={confirmAnular} onOpenChange={(o) => !o && setConfirmAnular(false)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("voidTitle")}</AlertDialogTitle>
            <AlertDialogDescription>{t("voidBody")}</AlertDialogDescription>
          </AlertDialogHeader>
          <Input value={motivoAnular} onChange={(e) => setMotivoAnular(e.target.value)} placeholder={t("voidReason")} autoFocus />
          <AlertDialogFooter>
            <AlertDialogCancel disabled={busy}>{tRoot("common.cancel")}</AlertDialogCancel>
            <Button variant="destructive" disabled={busy} onClick={anular}>{t("void")}</Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </li>
  );
}
