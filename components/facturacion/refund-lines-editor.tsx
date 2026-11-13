"use client";

import * as React from "react";
import { useTranslations } from "next-intl";

import type { RefundBalance, RefundEditWarning } from "@/lib/api/refund-detail";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { HugeiconsIcon } from "@hugeicons/react";
import { Add01Icon, MinusSignIcon, Alert02Icon } from "@hugeicons/core-free-icons";

const n = (v: unknown) => Number(v ?? 0);
const money = (v: unknown) => `$${n(v).toFixed(2)}`;

/** Same key for a balance row, a line in state, and a warning: `invoiceItemId` alone for the parent
 * line, `invoiceItemId::componentId` for a kit component underneath it. */
export function lineKey(invoiceItemId: string, componentId?: string | null): string {
  return componentId ? `${invoiceItemId}::${componentId}` : invoiceItemId;
}

export type LineState = { quantity: string; amount: string };

interface Props {
  balances: RefundBalance[];
  lineState: Record<string, LineState>;
  onLineChange: (key: string, patch: Partial<LineState>) => void;
  warningsByLine: Record<string, RefundEditWarning[]>;
}

// TODAS las líneas de la factura (de `balances`, BE PR #580) — no solo las ya devueltas — con un
// STEPPER (− / número / +) por línea: el máximo `refundable` es una GUÍA, no un tope (el dueño: «tiene
// que ser abierto»). Pasarse muestra el aviso que trae `simular`, nunca bloquea aquí. Los componentes
// de kit (invoiceItemComponentId no nulo) van anidados bajo su línea padre.
export function RefundLinesEditor({ balances, lineState, onLineChange, warningsByLine }: Props) {
  const t = useTranslations("devoluciones.editor");
  const tRoot = useTranslations();

  const parents = balances.filter((b) => !b.invoiceItemComponentId);
  const childrenOf = (invoiceItemId: string) => balances.filter((b) => b.invoiceItemComponentId && b.invoiceItemId === invoiceItemId);

  function step(key: string, current: LineState, delta: number) {
    const q = Math.max(0, n(current.quantity) + delta);
    onLineChange(key, { quantity: String(q) });
  }

  function row(b: RefundBalance, indent: boolean) {
    const key = lineKey(b.invoiceItemId, b.invoiceItemComponentId);
    const st = lineState[key] ?? { quantity: "0", amount: "" };
    const warnings = warningsByLine[key] ?? [];
    return (
      <tr key={key} className="align-top">
        <td className={"py-2 pr-2 " + (indent ? "pl-8 text-xs text-muted-foreground" : "")}>
          <span className={indent ? "" : "font-medium"}>{b.description}</span>
          {warnings.length > 0 && (
            <div className="mt-1 space-y-0.5">
              {warnings.map((w, i) => (
                <p key={i} className="flex items-start gap-1 text-xs text-warning-foreground">
                  <HugeiconsIcon icon={Alert02Icon} className="mt-0.5 size-3 shrink-0" />
                  <span>{tRoot.has(w.labelKey ?? "") ? tRoot(w.labelKey!, w.params as Record<string, string | number>) : w.code}</span>
                </p>
              ))}
            </div>
          )}
        </td>
        <td className="px-2 py-2 text-right text-xs tabular-nums text-muted-foreground">{b.sold}</td>
        <td className="px-2 py-2 text-right text-xs tabular-nums text-muted-foreground">{b.delivered}</td>
        <td className="px-2 py-2 text-right text-xs tabular-nums text-muted-foreground">{b.refundedElsewhere}</td>
        <td className="px-2 py-2 text-right text-xs tabular-nums text-muted-foreground">{b.refundable}</td>
        <td className="px-2 py-2">
          <div className="flex items-center justify-end gap-1">
            <Button type="button" variant="outline" size="icon" className="size-7" onClick={() => step(key, st, -1)}>
              <HugeiconsIcon icon={MinusSignIcon} className="size-3.5" />
            </Button>
            <Input
              value={st.quantity}
              onChange={(e) => onLineChange(key, { quantity: e.target.value.replace(/[^0-9]/g, "") })}
              className="h-7 w-14 text-center tabular-nums"
              inputMode="numeric"
            />
            <Button type="button" variant="outline" size="icon" className="size-7" onClick={() => step(key, st, 1)}>
              <HugeiconsIcon icon={Add01Icon} className="size-3.5" />
            </Button>
          </div>
        </td>
        <td className="py-2 pl-2">
          <Input
            value={st.amount}
            onChange={(e) => onLineChange(key, { amount: e.target.value })}
            placeholder={b.suggestedUnitAmount != null ? money(n(b.suggestedUnitAmount) * n(st.quantity)) : "0.00"}
            inputMode="decimal"
            className="h-7 w-24 text-right tabular-nums"
          />
        </td>
      </tr>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b text-left text-[11px] uppercase tracking-wide text-muted-foreground">
            <th className="pb-2 pr-2 font-semibold">{t("colConcepto")}</th>
            <th className="pb-2 px-2 text-right font-semibold">{t("colVendidas")}</th>
            <th className="pb-2 px-2 text-right font-semibold">{t("colEntregadas")}</th>
            <th className="pb-2 px-2 text-right font-semibold">{t("colDevueltasOtras")}</th>
            <th className="pb-2 px-2 text-right font-semibold">{t("colDevolvible")}</th>
            <th className="pb-2 px-2 text-right font-semibold">{t("colCantidad")}</th>
            <th className="pb-2 pl-2 text-right font-semibold">{t("colMonto")}</th>
          </tr>
        </thead>
        <tbody className="divide-y">
          {parents.map((p) => (
            <React.Fragment key={p.invoiceItemId}>
              {row(p, false)}
              {childrenOf(p.invoiceItemId).map((c) => row(c, true))}
            </React.Fragment>
          ))}
        </tbody>
      </table>
    </div>
  );
}
