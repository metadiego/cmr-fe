"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { pickableMethods } from "@/lib/factura/payment-methods";
import { useTranslations } from "next-intl";
import { toast } from "sonner";

import {
  repararPago,
  anularPago,
  registrarPago,
  type FacturaPago,
  type FormaPago,
} from "@/lib/api/facturas";
import { ApiError } from "@/lib/api/types";
import { useCan } from "@/hooks/use-can";
import { formaPagoLabel } from "@/lib/facturacion/forma-pago-label";
import { topePago } from "@/lib/facturacion/tope-pago";
import { paymentAmountIssue, paymentRowMissing } from "@/lib/facturacion/payment-row-missing";
import { footerState } from "@/lib/forms/missing";
import { formatFechaSolo } from "@/lib/format/fecha";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { MissingHint } from "@/components/kit/missing-hint";
import { useConfirm } from "@/components/kit/confirm-host";
import { useSubmit } from "@/components/kit/use-submit";
import { HugeiconsIcon } from "@hugeicons/react";
import { Edit02Icon, Delete02Icon, Tick02Icon, Cancel01Icon, Add01Icon } from "@hugeicons/core-free-icons";

const n = (v: unknown) => Number(v ?? 0);
const money = (v: unknown) => `$${n(v).toFixed(2)}`;

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
  esBorrador = false,
  pastCashDay = null,
}: {
  pagos: FacturaPago[];
  formas: FormaPago[];
  id: string;
  centro?: string;
  busy: boolean;
  run: (fn: () => Promise<unknown>) => Promise<void>;
  saldo: number;
  montoAbonado: number;
  esBorrador?: boolean;
  // BE PR #582-583: solo el `day` hace falta aquí, para el tooltip del pago bloqueado.
  pastCashDay?: { day: string } | null;
}) {
  const t = useTranslations("pagosFactura");
  const router = useRouter();
  const { can } = useCan();
  // La puerta REST de editar/anular un pago es `factura.update`; el estado se comprueba en el server:
  // en borrador cualquiera que puede tocar la factura corrige su propio abono; ya emitida exige
  // además `factura.pago.anular` (anulación auditable). Ver pagos-tope-y-correccion-en-borrador-respuesta-be.
  const puedeEditar = can("factura.update") && (esBorrador || can("factura.pago.anular"));

  const [editId, setEditId] = React.useState<string | null>(null);
  const [agregando, setAgregando] = React.useState(false);
  const pagado = saldo <= 0.001;
  // Total = lo abonado + lo que falta. Sirve de tope: un abono no puede hacer que lo abonado exceda el total.
  const total = montoAbonado + saldo;

  // Anular el reembolso de una devolución ACTIVA desde aquí ya no se permite (BE PR #577): el BE
  // responde 400 REFUND_REIMBURSEMENT_VIA_REFUND. En vez del toast genérico, uno con enlace a la
  // devolución (p.refundId) — ahí es donde se repara. Handoff .personal/handoff-reparar-devolucion.md.
  function onAnular(p: FacturaPago) {
    run(() =>
      anularPago(id, p.id!, t("motivoAnulacion"), centro).catch((err) => {
        if (err instanceof ApiError && err.code === "REFUND_REIMBURSEMENT_VIA_REFUND" && p.refundId) {
          toast.error(t("viaRefundTitle"), {
            action: { label: t("viaRefundLink"), onClick: () => router.push(`/billing/invoices/${id}/returns/${p.refundId}${centro ? `?centro=${centro}` : ""}`) },
          });
          return;
        }
        throw err;
      }),
    );
  }

  return (
    <div className="space-y-2">
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
                total={total}
                abonado={montoAbonado}
                onDone={() => setEditId(null)}
              />
            ) : (
              <PagoViewRow
                key={p.id}
                pago={p}
                formas={formas}
                puedeEditar={puedeEditar}
                busy={busy}
                pastCashDay={pastCashDay}
                onEdit={() => setEditId(p.id ?? null)}
                onAnular={() => onAnular(p)}
              />
            ),
          )}
        </ul>
      )}

      {/* Estado del saldo, siempre a la vista para no confundir "Total" con "lo que falta":
          pendiente (ámbar) · saldada (verde, saldo $0) · sobre-abonada (ámbar con el exceso). */}
      {saldo > 0.005 ? (
        <div className="flex items-center justify-between rounded-md border border-warning/40 bg-warning px-2.5 py-1.5 text-sm">
          <span className="text-warning-foreground">{t("balance")}</span>
          <span className="font-semibold tabular-nums text-warning-foreground">{money(saldo)}</span>
        </div>
      ) : saldo < -0.005 ? (
        <div className="flex items-center justify-between rounded-md border border-warning/40 bg-warning px-2.5 py-1.5 text-sm">
          <span className="text-warning-foreground">{t("overpaid")}</span>
          <span className="font-semibold tabular-nums text-warning-foreground">{money(-saldo)}</span>
        </div>
      ) : (
        <div className="flex items-center justify-between rounded-md border border-success/40 bg-success px-2.5 py-1.5 text-sm">
          <span className="text-success-foreground">{t("settled")}</span>
          <span className="font-semibold tabular-nums text-success-foreground">{money(0)}</span>
        </div>
      )}

      {/* Con la factura ya saldada no se ofrece agregar otro abono (evita sobre-pagar); para corregir se
          edita o se anula un pago existente. */}
      {agregando ? (
        <PagoAddRow
          formas={formas}
          id={id}
          centro={centro}
          busy={busy}
          run={run}
          tope={topePago(total, montoAbonado)}
          onDone={() => setAgregando(false)}
        />
      ) : !pagado ? (
        <Button type="button" variant="outline" size="sm" className="w-full gap-1.5" disabled={busy} onClick={() => setAgregando(true)}>
          <HugeiconsIcon icon={Add01Icon} className="size-4" />
          {t("addPayment")}
        </Button>
      ) : null}
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
        (esReembolso ? "bg-destructive/15 text-destructive" : "bg-success text-success-foreground")
      }
    >
      {esReembolso ? t("refund") : t("payment")}
    </span>
  );
}

function PagoViewRow({
  pago,
  formas,
  puedeEditar,
  busy,
  pastCashDay,
  onEdit,
  onAnular,
}: {
  pago: FacturaPago;
  formas: FormaPago[];
  puedeEditar: boolean;
  busy: boolean;
  pastCashDay?: { day: string } | null;
  onEdit: () => void;
  onAnular: () => void;
}) {
  const t = useTranslations("pagosFactura");
  const tRoot = useTranslations();
  const confirm = useConfirm();
  const esReembolso = pago.type === "reembolso";
  const fecha = formatFechaSolo(pago.date);
  // El pago sólo trae `formaPagoNombre` (español); resolvemos la `clave` por `paymentMethodId` para traducir.
  const clave = formas.find((f) => f.id === pago.paymentMethodId)?.slug;
  const label = formaPagoLabel(tRoot, clave, pago.formaPagoNombre);

  return (
    <li className="flex items-center gap-2 rounded-lg bg-muted/30 px-2.5 py-1.5 text-sm">
      <TipoBadge tipo={pago.type} />
      <span className="min-w-0 flex-1">
        <span className="block truncate font-medium">{label}</span>
        {(fecha || pago.reference) && (
          <span className="block truncate text-xs text-muted-foreground">
            {pago.reference ? `${pago.reference} · ` : ""}{fecha}
          </span>
        )}
      </span>
      <span className={"shrink-0 tabular-nums font-medium " + (esReembolso ? "text-destructive" : "")}>
        {esReembolso ? "−" : ""}{money(pago.amount)}
      </span>
      {puedeEditar && (() => {
        // BE PR #582-583: este pago toca el cuadre de un día pasado ya cerrado — ni anular ni
        // corregir, aunque la factura sea de hoy. Handoff .personal/handoff-bloqueo-dias-pasados.md.
        const bloqueado = !!pago.pastDayLocked;
        const titulo = bloqueado ? tRoot("cash.pastDay.locked", { day: pastCashDay?.day ?? "" }) : undefined;
        return (
          <span className="flex shrink-0 items-center">
            <Button type="button" variant="ghost" size="icon" className="size-7" disabled={busy || bloqueado} title={titulo} aria-label={t("edit")} onClick={onEdit}>
              <HugeiconsIcon icon={Edit02Icon} className="size-3.5" />
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="size-7 text-destructive"
              disabled={busy || bloqueado}
              title={titulo}
              aria-label={t("void")}
              onClick={async () => {
                const ok = await confirm({
                  title: t("voidTitle"),
                  description: t("voidBody"),
                  confirmLabel: t("void"),
                  destructive: true,
                });
                if (ok) onAnular();
              }}
            >
              <HugeiconsIcon icon={Delete02Icon} className="size-3.5" />
            </Button>
          </span>
        );
      })()}
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
  total,
  abonado,
  onDone,
}: {
  pago: FacturaPago;
  formas: FormaPago[];
  id: string;
  centro?: string;
  busy: boolean;
  run: (fn: () => Promise<unknown>) => Promise<void>;
  total: number;
  abonado: number;
  onDone: () => void;
}) {
  const t = useTranslations("pagosFactura");
  const tRoot = useTranslations();
  const [formaId, setFormaId] = React.useState(pago.paymentMethodId ?? "");
  const [monto, setMonto] = React.useState(String(n(pago.amount).toFixed(2)));
  const cambio = formaId !== (pago.paymentMethodId ?? "") || n(monto) !== n(pago.amount);
  // Tope solo para pagos (los reembolsos tienen su propia regla): al editar, el importe ACTUAL se libera.
  const esReembolso = pago.type === "reembolso";
  const tope = topePago(total, abonado, n(pago.amount));
  // Empty → listed in the hint; filled but invalid → its own message. Over the cap is the red line
  // under the row (it was already there), so it is not repeated in the hint.
  const issue = paymentAmountIssue(monto, esReembolso ? null : tope);
  const excede = issue === "exceedsCap";
  const missing = paymentRowMissing({ methodId: formaId, amount: monto }).map((f) => t(f === "method" ? "method" : "amount"));
  const { submitting, submit } = useSubmit(
    // `run` toasts the API error itself and never throws; the row closes after it either way, as before.
    () => {
      if (!pago.id) throw new Error("payment without id");
      return run(() => repararPago(id, pago.id!, { paymentMethodId: formaId, amount: n(monto), reason: t("motivoCorreccion") }, centro));
    },
    { onSuccess: onDone },
  );
  const rowState = {
    missing,
    reason: issue === "notPositive" ? t("amountNotPositive") : !cambio ? t("noChanges") : null,
    blocked: issue !== null || !cambio,
    submitting: busy || submitting,
  };
  const { disabled, hint } = footerState(rowState);
  const hintId = React.useId() + "-hint";

  return (
    <li className="space-y-1.5 rounded-lg border px-2.5 py-2">
      <div className="flex items-center gap-1.5">
        <TipoBadge tipo={pago.type} />
        <Select value={formaId} onValueChange={setFormaId}>
          <SelectTrigger size="sm" className="h-8 flex-1"><SelectValue placeholder={t("method")} /></SelectTrigger>
          <SelectContent>
            {pickableMethods(formas).map((f) => <SelectItem key={f.id} value={f.id}>{formaPagoLabel(tRoot, f.slug, f.name)}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>
      <div className="flex items-center gap-1.5">
        <Input value={monto} onChange={(e) => setMonto(e.target.value)} inputMode="decimal" onFocus={(e) => e.currentTarget.select()} className={"h-8 flex-1 text-right tabular-nums" + (excede ? " ring-1 ring-destructive" : "")} aria-invalid={excede} aria-label={t("amount")} />
        <Button type="button" size="icon" className="size-8" disabled={disabled} aria-label={t("save")} aria-describedby={hint ? hintId : undefined} onClick={() => submit()}>
          <HugeiconsIcon icon={Tick02Icon} className="size-4" />
        </Button>
        <Button type="button" variant="ghost" size="icon" className="size-8" disabled={busy} aria-label={t("cancel")} onClick={onDone}>
          <HugeiconsIcon icon={Cancel01Icon} className="size-4" />
        </Button>
      </div>
      {excede && <p className="text-xs text-destructive">{t("exceedsTotal", { max: money(tope) })}</p>}
      <MissingHint id={hintId} {...rowState} />
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
  tope,
  onDone,
}: {
  formas: FormaPago[];
  id: string;
  centro?: string;
  busy: boolean;
  run: (fn: () => Promise<unknown>) => Promise<void>;
  tope: number; // máximo abonable = saldo pendiente; sugerimos ese importe y no dejamos pasarse.
  onDone: () => void;
}) {
  const t = useTranslations("pagosFactura");
  const tRoot = useTranslations();
  const [formaId, setFormaId] = React.useState("");
  const [monto, setMonto] = React.useState(tope > 0 ? String(tope.toFixed(2)) : "");
  const [last4, setLast4] = React.useState("");
  const last4Ref = React.useRef<HTMLInputElement>(null);
  const forma = formas.find((f) => f.id === formaId);
  const esTarjeta = !!forma && forma.isCash === false;
  // Tarjeta: al elegirla, el foco salta directo al campo de los últimos 4 (velocidad del mostrador). Desde ahí
  // un solo Enter cierra el pago, se anoten los 4 dígitos o no. El Select de Radix devuelve el foco a su
  // trigger al cerrarse, así que se enfoca tras un tick para ganarle a esa restauración (si no, se queda en él).
  React.useEffect(() => {
    if (!esTarjeta) return;
    const h = setTimeout(() => last4Ref.current?.focus(), 60);
    return () => clearTimeout(h);
  }, [esTarjeta]);
  // Empty → listed in the hint; filled but invalid → its own message (over the cap: the red line below).
  const issue = paymentAmountIssue(monto, tope);
  const excede = issue === "exceedsCap";
  // The method is taken as a parameter because picking it from the select applies the payment in the same
  // event, before `formaId` has updated (setState is async).
  const rowStateFor = (methodId: string) => ({
    missing: paymentRowMissing({ methodId, amount: monto }).map((f) => t(f === "method" ? "method" : "amount")),
    reason: issue === "notPositive" ? t("amountNotPositive") : null,
    blocked: issue !== null,
    submitting: busy || submitting,
  });

  // Registers with the CURRENT amount. useSubmit's guard (plus the page's `busy`) stops a double charge
  // from a double click, a held Enter or click + Enter. `run` toasts the API error and never throws.
  const { submitting, submit } = useSubmit(
    (fid: string) => {
      const notas = last4.length === 4 ? `•••• ${last4}` : undefined;
      return run(() => registrarPago(id, { paymentMethodId: fid, amount: n(monto), ...(notas ? { notes: notas } : {}) } as never, centro));
    },
    { onSuccess: onDone },
  );
  const rowState = rowStateFor(formaId);
  const { disabled, hint } = footerState(rowState);
  const hintId = React.useId() + "-hint";

  // Fewer clicks (front-desk request): picking the method applies the payment AT ONCE, with the amount in
  // the field (the balance). A CARD is not auto-applied, so the last 4 can be noted first. To split, edit
  // the amount to the part before picking; that part is applied and the rest stays for another payment.
  // Money screen: reversible (void), capped at the balance. Nothing is applied while something is
  // missing or invalid — the hint under the row says what.
  function onPickForma(v: string) {
    setFormaId(v);
    const f = formas.find((x) => x.id === v);
    if (f && f.isCash !== false && !footerState(rowStateFor(v)).disabled) void submit(v); // not a card → applies at once
  }

  return (
    <div className="space-y-1.5 rounded-md border border-primary/30 bg-primary/5 px-2.5 py-2">
      <span className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">{t("addPayment")}</span>
      <Select value={formaId} onValueChange={onPickForma}>
        <SelectTrigger size="sm" className="h-8 w-full"><SelectValue placeholder={t("method")} /></SelectTrigger>
        <SelectContent>
          {pickableMethods(formas).map((f) => <SelectItem key={f.id} value={f.id}>{formaPagoLabel(tRoot, f.slug, f.name)}</SelectItem>)}
        </SelectContent>
      </Select>
      {esTarjeta && (
        <Input ref={last4Ref} value={last4} onChange={(e) => setLast4(e.target.value.replace(/\D/g, "").slice(0, 4))} onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); if (!disabled) void submit(formaId); } }} placeholder={t("cardLast4")} className="h-8 w-full tabular-nums" inputMode="numeric" aria-label={t("cardLast4")} />
      )}
      <div className="flex items-center gap-1.5">
        {/* Monto enfocado y SELECCIONADO al abrir: para dividir, se teclea el parcial de una sin borrar. */}
        <Input value={monto} onChange={(e) => setMonto(e.target.value)} inputMode="decimal" autoFocus onFocus={(e) => e.currentTarget.select()} className={"h-8 flex-1 text-right tabular-nums" + (excede ? " ring-1 ring-destructive" : "")} aria-invalid={excede} aria-label={t("amount")} />
        {/* Sin botón «Registrar»: al elegir el tipo se aplica solo. La TARJETA conserva un visto para confirmar
            tras anotar los últimos 4 (que no se autoaplica). Handoff: pedido del mostrador (menos clics). */}
        {esTarjeta && (
          <Button type="button" size="icon" className="size-8" disabled={disabled} aria-label={t("register")} aria-describedby={hint ? hintId : undefined} onClick={() => void submit(formaId)}>
            <HugeiconsIcon icon={Tick02Icon} className="size-4" />
          </Button>
        )}
        <Button type="button" variant="ghost" size="icon" className="size-8" disabled={busy} aria-label={t("cancel")} onClick={onDone}>
          <HugeiconsIcon icon={Cancel01Icon} className="size-4" />
        </Button>
      </div>
      {/* Split: para cobrar en varias formas se agrega un pago por cada forma; cada uno se topa al saldo restante. */}
      {excede
        ? <p className="text-xs text-destructive">{t("exceedsTotal", { max: money(tope) })}</p>
        : <p className="text-[11px] text-muted-foreground">{t("splitHint", { max: money(tope) })}</p>}
      <MissingHint id={hintId} {...rowState} />
    </div>
  );
}
