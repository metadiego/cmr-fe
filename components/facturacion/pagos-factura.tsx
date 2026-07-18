"use client";

import * as React from "react";
import { useTranslations, useLocale } from "next-intl";

import {
  repararPago,
  anularPago,
  registrarPago,
  type FacturaPago,
  type FormaPago,
} from "@/lib/api/facturas";
import { useCan } from "@/hooks/use-can";
import { formaPagoLabel } from "@/lib/facturacion/forma-pago-label";
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
import { Edit02Icon, Delete02Icon, Tick02Icon, Cancel01Icon, Add01Icon } from "@hugeicons/core-free-icons";

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

// Bloque de PAGOS de una factura emitida. Todo a la vista, sin modos ocultos:
//   - cada fila (pago o reembolso) muestra su ✎ Editar y 🗑 Anular SIEMPRE visibles (gate RBAC
//     factura.pago.anular). Editar es inline: cambia forma/monto en la misma fila.
//   - "+ Agregar pago" vive DENTRO del bloque (no una caja suelta).
// El reembolso de una devolución es un pago tipo=reembolso: el MISMO PUT cambia su forma (pagó tarjeta
// → reembolsa cheque), preservando el tipo. Handoff fe-editar-formas-de-pago (#112).
export function PagosFactura({
  pagos,
  formas,
  id,
  centro,
  busy,
  run,
  saldo,
  montoAbonado,
}: {
  pagos: FacturaPago[];
  formas: FormaPago[];
  id: string;
  centro?: string;
  busy: boolean;
  run: (fn: () => Promise<unknown>) => Promise<void>;
  saldo: number;
  montoAbonado: number;
}) {
  const t = useTranslations("pagosFactura");
  const locale = useLocale();
  const { can } = useCan();
  const puedeEditar = can("factura.pago.anular");

  const [editId, setEditId] = React.useState<string | null>(null);
  const [agregando, setAgregando] = React.useState(false);
  const pagado = saldo <= 0.001;

  return (
    <div className="space-y-2 rounded-xl border p-4">
      <div className="flex items-center justify-between">
        <span className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">{t("title")}</span>
        <span className="text-xs text-muted-foreground">
          {t("paid")} <span className="font-semibold text-foreground tabular-nums">{money(montoAbonado)}</span>
        </span>
      </div>

      {pagos.length > 0 && (
        <ul className="space-y-1.5">
          {pagos.map((p) =>
            puedeEditar && editId === p.id ? (
              <PagoEditRow
                key={p.id}
                pago={p}
                formas={formas}
                id={id}
                centro={centro}
                busy={busy}
                run={run}
                onDone={() => setEditId(null)}
              />
            ) : (
              <PagoViewRow
                key={p.id}
                pago={p}
                formas={formas}
                locale={locale}
                puedeEditar={puedeEditar}
                busy={busy}
                onEdit={() => setEditId(p.id ?? null)}
                onAnular={() => run(() => anularPago(id, p.id!, t("motivoAnulacion"), centro))}
              />
            ),
          )}
        </ul>
      )}

      {!pagado && (
        <div className="flex items-center justify-between rounded-lg bg-amber-500/10 px-2.5 py-1.5 text-sm">
          <span className="text-amber-700 dark:text-amber-400">{t("balance")}</span>
          <span className="font-semibold tabular-nums text-amber-700 dark:text-amber-400">{money(saldo)}</span>
        </div>
      )}

      {agregando ? (
        <PagoAddRow
          formas={formas}
          id={id}
          centro={centro}
          busy={busy}
          run={run}
          saldoSugerido={saldo > 0.001 ? saldo : 0}
          onDone={() => setAgregando(false)}
        />
      ) : (
        <Button type="button" variant="outline" size="sm" className="w-full gap-1.5" disabled={busy} onClick={() => setAgregando(true)}>
          <HugeiconsIcon icon={Add01Icon} className="size-4" />
          {t("addPayment")}
        </Button>
      )}
    </div>
  );
}

function TipoBadge({ tipo }: { tipo?: string }) {
  const t = useTranslations("pagosFactura");
  const esReembolso = tipo === "reembolso";
  return (
    <span
      className={
        "shrink-0 rounded-full px-1.5 py-0.5 text-[10px] font-semibold " +
        (esReembolso ? "bg-destructive/15 text-destructive" : "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400")
      }
    >
      {esReembolso ? t("refund") : t("payment")}
    </span>
  );
}

function PagoViewRow({
  pago,
  formas,
  locale,
  puedeEditar,
  busy,
  onEdit,
  onAnular,
}: {
  pago: FacturaPago;
  formas: FormaPago[];
  locale: string;
  puedeEditar: boolean;
  busy: boolean;
  onEdit: () => void;
  onAnular: () => void;
}) {
  const t = useTranslations("pagosFactura");
  const tRoot = useTranslations();
  const [confirmAnular, setConfirmAnular] = React.useState(false);
  const esReembolso = pago.tipo === "reembolso";
  const fecha = fmtFecha(pago.fecha, locale);
  // El pago sólo trae `formaPagoNombre` (español); resolvemos la `clave` por `formaPagoId` para traducir.
  const clave = formas.find((f) => f.id === pago.formaPagoId)?.clave;
  const label = formaPagoLabel(tRoot, clave, pago.formaPagoNombre);

  return (
    <li className="flex items-center gap-2 rounded-lg bg-muted/30 px-2.5 py-1.5 text-sm">
      <TipoBadge tipo={pago.tipo} />
      <span className="min-w-0 flex-1">
        <span className="block truncate font-medium">{label}</span>
        {(fecha || pago.referencia) && (
          <span className="block truncate text-xs text-muted-foreground">
            {pago.referencia ? `${pago.referencia} · ` : ""}{fecha}
          </span>
        )}
      </span>
      <span className={"shrink-0 tabular-nums font-medium " + (esReembolso ? "text-destructive" : "")}>
        {esReembolso ? "−" : ""}{money(pago.monto)}
      </span>
      {puedeEditar && (
        <span className="flex shrink-0 items-center">
          <Button type="button" variant="ghost" size="icon" className="size-7" disabled={busy} aria-label={t("edit")} onClick={onEdit}>
            <HugeiconsIcon icon={Edit02Icon} className="size-3.5" />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="size-7 text-destructive"
            disabled={busy}
            aria-label={t("void")}
            onClick={() => setConfirmAnular(true)}
          >
            <HugeiconsIcon icon={Delete02Icon} className="size-3.5" />
          </Button>
        </span>
      )}

      <AlertDialog open={confirmAnular} onOpenChange={(o) => !o && setConfirmAnular(false)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("voidTitle")}</AlertDialogTitle>
            <AlertDialogDescription>{t("voidBody")}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={busy}>{tRoot("common.cancel")}</AlertDialogCancel>
            <Button variant="destructive" disabled={busy} onClick={() => { setConfirmAnular(false); onAnular(); }}>{t("void")}</Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </li>
  );
}

// Edición INLINE de una fila: cambia forma (y monto) en la misma fila; guarda o cancela. Preserva el
// tipo (un reembolso sigue siendo reembolso). Append-only auditable (motivo por defecto).
function PagoEditRow({
  pago,
  formas,
  id,
  centro,
  busy,
  run,
  onDone,
}: {
  pago: FacturaPago;
  formas: FormaPago[];
  id: string;
  centro?: string;
  busy: boolean;
  run: (fn: () => Promise<unknown>) => Promise<void>;
  onDone: () => void;
}) {
  const t = useTranslations("pagosFactura");
  const tRoot = useTranslations();
  const [formaId, setFormaId] = React.useState(pago.formaPagoId ?? "");
  const [monto, setMonto] = React.useState(String(n(pago.monto).toFixed(2)));
  const cambio = formaId !== (pago.formaPagoId ?? "") || n(monto) !== n(pago.monto);
  const valido = !!formaId && n(monto) > 0;

  function guardar() {
    if (!pago.id || !cambio || !valido || busy) return;
    run(() => repararPago(id, pago.id!, { formaPagoId: formaId, monto: n(monto), motivo: t("motivoCorreccion") }, centro)).then(onDone);
  }

  return (
    <li className="space-y-1.5 rounded-lg border px-2.5 py-2">
      <div className="flex items-center gap-1.5">
        <TipoBadge tipo={pago.tipo} />
        <Select value={formaId} onValueChange={setFormaId}>
          <SelectTrigger size="sm" className="h-8 flex-1"><SelectValue placeholder={t("method")} /></SelectTrigger>
          <SelectContent>
            {formas.filter((f) => f.activo !== false).map((f) => <SelectItem key={f.id} value={f.id}>{formaPagoLabel(tRoot, f.clave, f.nombre)}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>
      <div className="flex items-center gap-1.5">
        <Input value={monto} onChange={(e) => setMonto(e.target.value)} inputMode="decimal" className="h-8 flex-1 text-right tabular-nums" aria-label={t("amount")} />
        <Button type="button" size="icon" className="size-8" disabled={!cambio || !valido || busy} aria-label={t("save")} onClick={guardar}>
          <HugeiconsIcon icon={Tick02Icon} className="size-4" />
        </Button>
        <Button type="button" variant="ghost" size="icon" className="size-8" disabled={busy} aria-label={t("cancel")} onClick={onDone}>
          <HugeiconsIcon icon={Cancel01Icon} className="size-4" />
        </Button>
      </div>
    </li>
  );
}

// Alta de un pago DENTRO del bloque. Tarjeta (no efectivo) permite anotar los últimos 4 (opcional).
function PagoAddRow({
  formas,
  id,
  centro,
  busy,
  run,
  saldoSugerido,
  onDone,
}: {
  formas: FormaPago[];
  id: string;
  centro?: string;
  busy: boolean;
  run: (fn: () => Promise<unknown>) => Promise<void>;
  saldoSugerido: number;
  onDone: () => void;
}) {
  const t = useTranslations("pagosFactura");
  const tRoot = useTranslations();
  const [formaId, setFormaId] = React.useState("");
  const [monto, setMonto] = React.useState(saldoSugerido > 0 ? String(saldoSugerido.toFixed(2)) : "");
  const [last4, setLast4] = React.useState("");
  const forma = formas.find((f) => f.id === formaId);
  const esTarjeta = !!forma && forma.esEfectivo === false;
  const valido = !!formaId && n(monto) > 0 && !busy;

  function registrar() {
    if (!valido) return;
    const notas = last4.length === 4 ? `•••• ${last4}` : undefined;
    run(() => registrarPago(id, { formaPagoId: formaId, monto: n(monto), ...(notas ? { notas } : {}) } as never, centro)).then(onDone);
  }

  return (
    <div className="space-y-1.5 rounded-lg border border-primary/30 bg-primary/5 px-2.5 py-2">
      <span className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">{t("addPayment")}</span>
      <Select value={formaId} onValueChange={setFormaId}>
        <SelectTrigger size="sm" className="h-8 w-full"><SelectValue placeholder={t("method")} /></SelectTrigger>
        <SelectContent>
          {formas.filter((f) => f.activo !== false).map((f) => <SelectItem key={f.id} value={f.id}>{formaPagoLabel(tRoot, f.clave, f.nombre)}</SelectItem>)}
        </SelectContent>
      </Select>
      {esTarjeta && (
        <Input value={last4} onChange={(e) => setLast4(e.target.value.replace(/\D/g, "").slice(0, 4))} placeholder={t("cardLast4")} className="h-8 w-full tabular-nums" inputMode="numeric" aria-label={t("cardLast4")} />
      )}
      <div className="flex items-center gap-1.5">
        <Input value={monto} onChange={(e) => setMonto(e.target.value)} inputMode="decimal" className="h-8 flex-1 text-right tabular-nums" aria-label={t("amount")} />
        <Button type="button" size="sm" className="h-8" disabled={!valido} onClick={registrar}>{t("register")}</Button>
        <Button type="button" variant="ghost" size="icon" className="size-8" disabled={busy} aria-label={t("cancel")} onClick={onDone}>
          <HugeiconsIcon icon={Cancel01Icon} className="size-4" />
        </Button>
      </div>
    </div>
  );
}
