"use client";

import { useTranslations } from "next-intl";

import type { DivisionCount } from "@/lib/api/caja";
import { cashierUnbalanced, descuadreOf, overrideDiffers } from "@/lib/caja/descuadre";
import { money } from "@/lib/caja/totales";
import { cn } from "@/lib/utils";
import { Panel, RecordTable, Td, Th } from "@/components/kit/panel";
import { DescuadreBox } from "@/components/caja/descuadre-box";

// Under each division of the cash total: the consolidated count that overrides the cashiers (with who
// made it), the division's own difference, and every cashier's count — each one that does not balance
// boxed in red. Fields are optional on purpose: an older BE without them renders only what it sends.
export function DivisionCashiers({ division, count }: { division: string; count: DivisionCount }) {
  const t = useTranslations("caja.descuadre");
  const o = count.override;
  const cashiers = count.cashiers ?? [];
  const red = overrideDiffers(o) || (count.hasCount && descuadreOf(count.difference) != null);
  if (!red && cashiers.length === 0) return null;
  return (
    <div className="space-y-2">
      {o && overrideDiffers(o) && (
        <DescuadreBox force label={t("overrideBy", { name: o.countedBy?.name || t("unregistered"), counted: money(o.counted), cashiersCounted: money(o.cashiersCounted) })} difference={o.difference} />
      )}
      {count.hasCount && <DescuadreBox label={t("division", { division })} difference={count.difference} />}
      {cashiers.length > 0 && (
        <Panel title={t("cashiers", { division })} className={cn(red && "border-destructive/50")}>
          <RecordTable
            head={
              <>
                <Th>{t("cashier")}</Th>
                <Th right>{t("counted")}</Th>
                <Th right>{t("fund")}</Th>
                <Th right>{t("expected")}</Th>
                <Th right>{t("difference")}</Th>
              </>
            }
          >
            {cashiers.map((c) => {
              const bad = cashierUnbalanced(c);
              const d = descuadreOf(c.difference);
              return (
                <tr
                  key={c.reconciliationId}
                  className={cn("tabular-nums", bad && "bg-destructive/10 text-destructive outline-1 -outline-offset-1 outline-destructive/50 outline")}
                >
                  <Td className={cn("font-medium", bad && "font-semibold")}>{c.name || "—"}</Td>
                  <Td className="text-right">{money(c.counted)}</Td>
                  <Td className="text-right">{money(c.fund)}</Td>
                  <Td className="text-right">{money(c.expected)}</Td>
                  <Td className={cn("text-right", bad ? "font-semibold" : "text-muted-foreground")}>
                    {d ? t(d.kind, { amount: money(d.amount) }) : t("balanced")}
                  </Td>
                </tr>
              );
            })}
          </RecordTable>
        </Panel>
      )}
    </div>
  );
}
