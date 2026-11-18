"use client"

import * as React from "react"
import { useFormatter, useTranslations } from "next-intl"

import type { KardexOwnerFormat } from "@/lib/api/inventory-kardex"
import { ownerClosing } from "@/lib/inventory/kardex"
import { parseDayUTC } from "@/lib/format/fecha"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"

// «Resumen gerencial» in the layout of the owner's paper sheet (vitamin C, Caguas, October): opening, one
// row per inbound with date, supplier and transfer/PO number, each MANUAL output with its adjustment
// number, applied (net of delivery reversals), one «load corrections» row only when they do not net to
// zero, the closing highlighted, and «Observaciones» by supplier. The BE classifies (cmr-be #626,
// handoff docs/specs/kardex-resumen-formato-dueno-handoff-be.md); this only paints it.
export function KardexOwnerSummary({
  data,
  to,
}: {
  data: KardexOwnerFormat
  from: string
  to: string
}) {
  const t = useTranslations("inventoryKardex.owner")
  const tk = useTranslations("inventoryKardex")
  const format = useFormatter()
  const num = (v: number | null | undefined, d = 0) =>
    v == null
      ? "—"
      : format.number(v, { minimumFractionDigits: d, maximumFractionDigits: 2 })
  const dayText = (d: string) => {
    const date = parseDayUTC(d.slice(0, 10))
    return date ? format.dateTime(date, "dayShort") : d
  }
  const reasonText = (r: string | null) =>
    !r ? "" : tk.has(`reason.${r}`) ? tk(`reason.${r}`) : r
  // A mismatch would mean the BE and the sheet disagree: show it instead of hiding it.
  const computed = ownerClosing(data)
  const mismatch = Math.abs(computed - data.closing) > 0.001

  return (
    <div className="max-w-4xl space-y-3">
      <div className="overflow-hidden rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t("concept")}</TableHead>
              <TableHead className="w-32 text-right">{t("quantity")}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            <TableRow className="bg-muted/40">
              <TableCell className="font-semibold uppercase">
                {t("opening")}
              </TableCell>
              <TableCell className="text-right font-semibold tabular-nums">
                {num(data.opening)}
              </TableCell>
            </TableRow>
            {data.inbound.map((l, i) => (
              <TableRow key={`in-${i}`}>
                <TableCell>
                  <div className="uppercase">
                    {t("inbound", { date: dayText(l.date) })}
                  </div>
                  <div className="uppercase">
                    {l.supplier || t("noSupplier")}
                  </div>
                  <div className="text-xs text-muted-foreground uppercase">
                    {t("transfer")} #{" "}
                    <span className="font-mono text-foreground normal-case">
                      {l.documentNumber || "—"}
                    </span>
                  </div>
                </TableCell>
                <TableCell className="text-right tabular-nums">
                  {num(l.quantity)}
                </TableCell>
              </TableRow>
            ))}
            {data.manualOutputs.map((l, i) => (
              <TableRow key={`out-${i}`}>
                <TableCell>
                  <div className="uppercase">
                    {[
                      reasonText(l.reason),
                      l.adjustmentNumber != null
                        ? `${t("adjustment")} # ${l.adjustmentNumber}`
                        : null,
                      dayText(l.date),
                    ]
                      .filter(Boolean)
                      .join(" · ")}
                  </div>
                  {l.notes && (
                    <div className="text-xs text-muted-foreground">
                      {l.notes}
                    </div>
                  )}
                </TableCell>
                <TableCell className="text-right tabular-nums">
                  {num(Math.abs(l.quantity))}
                </TableCell>
              </TableRow>
            ))}
            {data.correctionsNet !== 0 && (
              <TableRow>
                <TableCell>
                  <div className="uppercase">{t("corrections")}</div>
                  <div className="text-xs text-muted-foreground">
                    {data.corrections
                      .map(
                        (c) =>
                          `${dayText(c.date)} ${reasonText(c.reason)} ${num(c.quantity)}`
                      )
                      .join(" · ")}
                  </div>
                </TableCell>
                <TableCell className="text-right tabular-nums">
                  {data.correctionsNet > 0 ? "+" : ""}
                  {num(data.correctionsNet)}
                </TableCell>
              </TableRow>
            )}
            <TableRow>
              <TableCell className="font-semibold uppercase">
                {t("applied", { date: dayText(to) })}
                {data.appliedProportion != null && (
                  <span className="ml-2 text-xs font-normal text-muted-foreground normal-case">
                    ({tk("col.proportion")}: {num(data.appliedProportion, 2)})
                  </span>
                )}
              </TableCell>
              <TableCell className="text-right font-semibold tabular-nums">
                {num(data.appliedNet)}
              </TableCell>
            </TableRow>
            <TableRow className="bg-muted">
              <TableCell className="text-base font-bold uppercase">
                {t("closing", { date: dayText(to) })}
              </TableCell>
              <TableCell className="text-right text-base font-bold tabular-nums">
                {num(data.closing)}
              </TableCell>
            </TableRow>
          </TableBody>
        </Table>
      </div>

      {data.closingBySupplier.length > 0 && (
        <div className="text-sm">
          <div className="font-semibold italic">{t("observations")}</div>
          {data.closingBySupplier.map((s, i) => (
            <div key={i} className="italic">
              {s.supplier || t("noSupplier")}:{" "}
              <span className="tabular-nums">
                {t("units", { n: num(s.quantity) })}
              </span>
            </div>
          ))}
        </div>
      )}
      {mismatch && (
        <p className="text-sm text-destructive">
          {t("mismatch", {
            computed: num(computed),
            closing: num(data.closing),
          })}
        </p>
      )}
    </div>
  )
}
