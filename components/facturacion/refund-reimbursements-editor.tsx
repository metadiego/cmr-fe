"use client";

import * as React from "react";
import { useTranslations } from "next-intl";

import { pickableMethods } from "@/lib/factura/payment-methods";
import { formaPagoLabel } from "@/lib/facturacion/forma-pago-label";
import type { FormaPago } from "@/lib/api/facturas";
import type { RefundReimbursement } from "@/lib/api/refund-detail";
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
import { HugeiconsIcon } from "@hugeicons/react";
import { Add01Icon, Delete02Icon } from "@hugeicons/core-free-icons";

const n = (v: unknown) => Number(v ?? 0);
const money = (v: unknown) => `$${n(v).toFixed(2)}`;

export type ReimbursementLine = { paymentMethodId: string; amount: string };

// Reembolsos EN LA MISMA pantalla (BE PR #580), no un modal aparte: una o varias formas (Visa + cheque
// a la vez), con el HUECO visible en vivo (contra el `refundedAmount` que devuelve `simular` con la
// edición actual, no el de la devolución guardada) y los anulados tachados debajo.
export function RefundReimbursementsEditor({
  lines,
  onChange,
  formas,
  target,
  voided,
}: {
  lines: ReimbursementLine[];
  onChange: (lines: ReimbursementLine[]) => void;
  formas: FormaPago[];
  target: number;
  voided: RefundReimbursement[];
}) {
  const t = useTranslations("devoluciones");
  const tRoot = useTranslations();
  const opciones = pickableMethods(formas);
  const total = lines.reduce((s, l) => s + n(l.amount), 0);
  const gap = n(target) - total;
  const cuadra = Math.abs(gap) < 0.01;

  function setLinea(i: number, patch: Partial<ReimbursementLine>) {
    onChange(lines.map((l, j) => (j === i ? { ...l, ...patch } : l)));
  }

  return (
    <div className="space-y-2">
      {lines.map((l, i) => (
        <div key={i} className="flex items-center gap-1.5">
          <Select value={l.paymentMethodId} onValueChange={(v) => setLinea(i, { paymentMethodId: v })}>
            <SelectTrigger size="sm" className="h-8 flex-1"><SelectValue placeholder={t("colMetodo")} /></SelectTrigger>
            <SelectContent>
              {opciones.map((f) => <SelectItem key={f.id} value={f.id}>{formaPagoLabel(tRoot, f.slug, f.name)}</SelectItem>)}
            </SelectContent>
          </Select>
          <Input
            value={l.amount}
            onChange={(e) => setLinea(i, { amount: e.target.value })}
            inputMode="decimal"
            onFocus={(e) => e.currentTarget.select()}
            className="h-8 w-24 text-right tabular-nums"
          />
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="size-8 text-destructive"
            disabled={lines.length <= 1}
            onClick={() => onChange(lines.filter((_, j) => j !== i))}
          >
            <HugeiconsIcon icon={Delete02Icon} className="size-3.5" />
          </Button>
        </div>
      ))}
      <Button type="button" variant="outline" size="sm" className="gap-1.5" onClick={() => onChange([...lines, { paymentMethodId: "", amount: "" }])}>
        <HugeiconsIcon icon={Add01Icon} className="size-4" />
        {t("agregarLinea")}
      </Button>

      <div className={"flex justify-between text-sm font-medium " + (cuadra ? "text-success-foreground" : "text-warning-foreground")}>
        <span>{t("colMonto")}</span>
        <span className="tabular-nums">{money(total)} / {money(target)}</span>
      </div>

      {voided.length > 0 && (
        <ul className="space-y-1 border-t pt-2">
          {voided.map((r) => (
            <li key={r.id} className="text-xs text-muted-foreground line-through decoration-destructive/60">
              <span className="flex justify-between gap-2">
                <span>{formaPagoLabel(tRoot, formas.find((f) => f.id === r.paymentMethodId)?.slug, r.paymentMethodName)}</span>
                <span className="tabular-nums">{money(r.amount)}</span>
              </span>
              <span className="block no-underline">
                {t("anuladaPor", { quien: r.cancelledByName || "—", fecha: formatFechaSolo(r.cancelledAt) || "—" })}
                {r.cancellationReason ? ` · ${r.cancellationReason}` : ""}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
