"use client"

import { useFormatter, useTranslations } from "next-intl"

import type { KardexDaily } from "@/lib/api/inventory-kardex"
import { formatFechaSolo } from "@/lib/format/fecha"
import { Button } from "@/components/ui/button"
import {
  Table,
  TableBody,
  TableCell,
  TableFooter,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"

// The "daily" tab of the per-product kardex: one row per day, opening→closing, with a "ver día" drill
// into that day's movements. Split out of app/(app)/inventory/kardex/page.tsx to keep that file under
// the 600-line ceiling (eslint.config.mjs) once the "all products" mode landed next to it.
export function KardexDailyTable({
  daily,
  appliedProportion,
  onViewDay,
}: {
  daily: KardexDaily
  appliedProportion: number | null | undefined
  onViewDay: (date: string) => void
}) {
  const t = useTranslations("inventoryKardex")
  const format = useFormatter()
  const withProportion = daily.product.capacity != null
  const dayText = (d: string) => formatFechaSolo(d) || d
  const num = (v: number | null | undefined, decimals = 0) =>
    v == null ? "—" : format.number(v, { minimumFractionDigits: decimals, maximumFractionDigits: 2 })
  const totals = daily.days.reduce(
    (a, d) => ({
      inbound: a.inbound + d.inbound,
      applied: a.applied + d.applied,
      adjustments: a.adjustments + d.adjustments,
    }),
    { inbound: 0, applied: 0, adjustments: 0 }
  )

  return (
    <div className="rounded-lg border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>{t("col.date")}</TableHead>
            <TableHead className="text-right">{t("col.opening")}</TableHead>
            <TableHead className="text-right">{t("col.inbound")}</TableHead>
            <TableHead className="text-right">{t("col.applied")}</TableHead>
            {withProportion && <TableHead className="text-right">{t("col.proportion")}</TableHead>}
            <TableHead className="text-right">{t("col.adjustments")}</TableHead>
            <TableHead className="text-right">{t("col.closing")}</TableHead>
            <TableHead className="no-print text-right">{t("col.actions")}</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {daily.days.map((d) => {
            // Dimmed, not disabled: adjustments can net to zero (+133 / −133 on 1-nov) and still be there.
            const quiet = !d.inbound && !d.applied && !d.adjustments
            return (
              <TableRow key={d.date} className={quiet ? "text-muted-foreground" : undefined}>
                <TableCell className="tabular-nums">{dayText(d.date)}</TableCell>
                <TableCell className="text-right tabular-nums">{num(d.opening)}</TableCell>
                <TableCell className="text-right tabular-nums">{d.inbound ? num(d.inbound) : ""}</TableCell>
                <TableCell className="text-right tabular-nums">{d.applied ? num(d.applied) : ""}</TableCell>
                {withProportion && (
                  <TableCell className="text-right text-xs text-muted-foreground tabular-nums">
                    {d.appliedProportion ? num(d.appliedProportion, 2) : ""}
                  </TableCell>
                )}
                <TableCell className="text-right tabular-nums">{d.adjustments ? num(d.adjustments) : ""}</TableCell>
                <TableCell className="text-right font-medium text-foreground tabular-nums">
                  {num(d.closing)}
                </TableCell>
                <TableCell className="no-print py-1 text-right">
                  <Button size="sm" variant="ghost" onClick={() => onViewDay(d.date)}>
                    {t("viewDay")}
                  </Button>
                </TableCell>
              </TableRow>
            )
          })}
        </TableBody>
        <TableFooter>
          <TableRow>
            <TableCell className="font-semibold">{t("periodTotal")}</TableCell>
            <TableCell className="text-right tabular-nums">{num(daily.days[0]?.opening)}</TableCell>
            <TableCell className="text-right font-semibold tabular-nums">{num(totals.inbound)}</TableCell>
            <TableCell className="text-right font-semibold tabular-nums">{num(totals.applied)}</TableCell>
            {withProportion && (
              <TableCell className="text-right text-xs tabular-nums">{num(appliedProportion, 2)}</TableCell>
            )}
            <TableCell className="text-right font-semibold tabular-nums">{num(totals.adjustments)}</TableCell>
            <TableCell className="text-right font-semibold tabular-nums">{num(daily.days.at(-1)?.closing)}</TableCell>
            <TableCell className="no-print" />
          </TableRow>
        </TableFooter>
      </Table>
    </div>
  )
}
