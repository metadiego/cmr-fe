"use client";

import { useTranslations } from "next-intl";

import type { InvoiceTotals } from "@/lib/factura/totals";
import { Badge } from "@/components/ui/badge";

// Under the invoice's Total: Pagado, Reembolsado (negative), Saldo — with «Devuelta» when the refunds
// cover the total — and each payment (+) / refund (−) with its method and date. Straight from the BE's
// totals block (BE #536); nothing is computed here. Money in the invoice screen's own format.
const money = (v: number) => (v < 0 ? "−" : "") + "$" + Math.abs(v).toFixed(2);
export function InvoiceTotalsTail({ totals }: { totals: InvoiceTotals }) {
  const tRoot = useTranslations();
  const t = useTranslations("facturacion");
  const label = (k: string, fallback: string) => (tRoot.has(k) ? tRoot(k) : fallback);
  const tail = totals.lines.filter((l) => l.key === "paid" || (l.key === "refunded" && l.amount !== 0) || l.key === "balance");
  return (
    <div className="space-y-1 text-sm">
      {tail.map((l) => (
        <div key={l.key} className={"flex items-center justify-between " + (l.key === "balance" ? "font-semibold" : "")}>
          <span className="text-muted-foreground">
            {label(l.labelKey, l.key)}
            {l.key === "balance" && totals.fullyReturned && <Badge variant="secondary" className="ml-2">{t("returnedBadge")}</Badge>}
          </span>
          <span className={"tabular-nums " + (l.amount < 0 ? "text-destructive" : "")}>{money(l.amount)}</span>
        </div>
      ))}
      {totals.moves.length > 0 && (
        <ul className="mt-1 space-y-0.5 border-t pt-1 text-xs text-muted-foreground">
          {totals.moves.map((m, i) => (
            <li key={i} className="flex justify-between gap-2">
              <span>
                {label(m.labelKey, m.kind)}
                {m.method ? ` · ${m.method}` : ""}
                {m.date ? ` · ${m.date}` : ""}
              </span>
              <span className={"tabular-nums " + (m.amount < 0 ? "text-destructive" : "")}>{money(m.amount)}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
