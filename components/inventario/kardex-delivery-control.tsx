"use client"

import * as React from "react"
import Link from "next/link"
import { useFormatter, useTranslations } from "next-intl"

import type { KardexDeliveryControl } from "@/lib/api/inventory-kardex"
import { deliveryObservationsText, groupDeliveryLines, visibleDeliveryWarnings } from "@/lib/inventory/delivery-control"
import { formatFechaSolo, parseDayUTC } from "@/lib/format/fecha"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Panel, StatGrid, Stat, EmptyState } from "@/components/kit/panel"
import {
  Table,
  TableBody,
  TableCell,
  TableFooter,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"

// "Control de entregas": what was sold and what is still owed, per product — the owner's October
// paper sheet for Nano Aer Plus (cmr-be #688/#690, handoff
// .personal/handoff-control-de-entregas-por-producto.md). Generic for any product sold and delivered
// later at patient-desk; nothing here is Nano-Aer-Plus-specific. Grouping/CSV logic lives in
// lib/inventory/delivery-control.ts so the screen and the CSV export agree byte for byte.
export function KardexDeliveryControlView({ data }: { data: KardexDeliveryControl }) {
  const t = useTranslations("inventoryKardex")
  const format = useFormatter()
  const num = (v: number) =>
    format.number(v, { minimumFractionDigits: 0, maximumFractionDigits: 2 })
  const dayText = (d: string) => formatFechaSolo(d) || d
  const monthLabel = (m: string | null) =>
    m ? format.dateTime(parseDayUTC(`${m}-01`) ?? new Date(), "monthYear") : t("delivery.legacyMonth")
  const warningText = (w: { code: string; quantity: number }) =>
    t.has(`delivery.warning.${w.code}`)
      ? t(`delivery.warning.${w.code}`, { quantity: w.quantity })
      : t("delivery.warning.unknown", { code: w.code, quantity: w.quantity })

  const groups = groupDeliveryLines(data.lines, data.months)
  const warnings = visibleDeliveryWarnings(data.warnings, data.warehouse)

  return (
    <div className="space-y-4">
      {warnings.map((w, i) => (
        <Alert key={i} variant="warning">
          <AlertDescription>{warningText(w)}</AlertDescription>
        </Alert>
      ))}

      {data.lines.length === 0 ? (
        <EmptyState>{t("delivery.empty")}</EmptyState>
      ) : (
        <div className="rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t("delivery.col.record")}</TableHead>
                <TableHead>{t("delivery.col.patient")}</TableHead>
                <TableHead>{t("delivery.col.date")}</TableHead>
                <TableHead>{t("delivery.col.invoice")}</TableHead>
                <TableHead className="text-right">{t("delivery.col.sold")}</TableHead>
                <TableHead className="text-right">{t("delivery.col.delivered")}</TableHead>
                <TableHead>{t("delivery.col.deliveryDates")}</TableHead>
                <TableHead className="text-right">{t("delivery.col.pending")}</TableHead>
                <TableHead>{t("delivery.col.notes")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {groups.map((g) => (
                <React.Fragment key={g.month ?? "legacy"}>
                  {g.lines.map((l) => (
                    <TableRow key={l.patientId + (l.invoiceNumber ?? l.recordNumber ?? "")} className={l.refunded > 0 ? "bg-destructive/5" : undefined}>
                      <TableCell className="tabular-nums">
                        <Link href={`/boards/patient-desk?p=${l.patientId}`} className="hover:underline">
                          {l.recordNumber ?? "—"}
                        </Link>
                      </TableCell>
                      <TableCell>{l.patientName ?? "—"}</TableCell>
                      <TableCell className="tabular-nums">{l.invoiceDate ? dayText(l.invoiceDate) : "—"}</TableCell>
                      <TableCell className="font-mono text-xs">{l.invoiceNumber ?? "—"}</TableCell>
                      <TableCell className="text-right tabular-nums">{num(l.sold)}</TableCell>
                      <TableCell className="text-right tabular-nums">{num(l.delivered)}</TableCell>
                      <TableCell className="text-xs tabular-nums">
                        {l.deliveryDates.length ? l.deliveryDates.map(dayText).join(", ") : "—"}
                      </TableCell>
                      <TableCell className="text-right font-medium tabular-nums">{num(l.pending)}</TableCell>
                      <TableCell className="text-xs text-muted-foreground">{deliveryObservationsText(l, t)}</TableCell>
                    </TableRow>
                  ))}
                  {/* The month subtotal has to read faster than every data row above it (owner, 28-nov-2026):
                      the whole row tinted edge to edge, bold, the month in capitals. `kardex-month-row` is the
                      print CSS hook — REPORT_PRINT_CSS serializes this table's own innerHTML into a popup with
                      none of Tailwind's CSS loaded, so Tailwind's bg-muted/uppercase have no effect there. */}
                  <TableRow className="kardex-month-row border-t-2 border-foreground/30 bg-muted/60">
                    <TableCell colSpan={4} className="font-bold uppercase">
                      {monthLabel(g.month)}
                    </TableCell>
                    <TableCell className="text-right font-bold tabular-nums">{num(g.sold)}</TableCell>
                    <TableCell className="text-right font-bold tabular-nums">{num(g.delivered)}</TableCell>
                    <TableCell className="font-bold" />
                    <TableCell className="text-right font-bold tabular-nums">{num(g.pending)}</TableCell>
                    <TableCell className="font-bold" />
                  </TableRow>
                </React.Fragment>
              ))}
            </TableBody>
            <TableFooter>
              <TableRow>
                <TableCell colSpan={7} className="font-bold">
                  {t("delivery.totalPending")}
                </TableCell>
                <TableCell className="text-right text-base font-bold tabular-nums">{num(data.warehouse.pending)}</TableCell>
                <TableCell />
              </TableRow>
            </TableFooter>
          </Table>
        </div>
      )}

      {data.protocols.detail.length > 0 && (
        <Panel title={t("delivery.protocolsTitle")} description={t("delivery.protocolsTotal", { n: num(data.protocols.total) })}>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t("delivery.col.record")}</TableHead>
                <TableHead>{t("delivery.col.patient")}</TableHead>
                <TableHead>{t("delivery.col.date")}</TableHead>
                <TableHead>{t("delivery.protocolsCol.protocol")}</TableHead>
                <TableHead className="text-right">{t("delivery.col.sold")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.protocols.detail.map((p, i) => (
                <TableRow key={i}>
                  <TableCell className="tabular-nums">{p.recordNumber ?? "—"}</TableCell>
                  <TableCell>{p.patientName ?? "—"}</TableCell>
                  <TableCell className="tabular-nums">{dayText(p.date)}</TableCell>
                  <TableCell>{p.protocol}</TableCell>
                  <TableCell className="text-right tabular-nums">{num(p.quantity)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Panel>
      )}

      <Panel title={t("delivery.warehouseTitle")}>
        <StatGrid cols={3}>
          <Stat label={t("delivery.warehouse.freeStock")} value={num(data.warehouse.freeStock)} tone={data.warehouse.freeStock < 0 ? "danger" : undefined} />
          <Stat label={t("delivery.warehouse.pending")} value={num(data.warehouse.pending)} />
          <Stat label={t("delivery.warehouse.physical")} value={num(data.warehouse.physical)} />
          <Stat label={t("delivery.warehouse.soldInPeriod")} value={num(data.warehouse.soldInPeriod)} />
          <Stat label={t("delivery.warehouse.protocols")} value={num(data.warehouse.protocols)} />
          <Stat label={t("delivery.warehouse.systemStock")} value={num(data.warehouse.systemStock)} />
        </StatGrid>
      </Panel>
    </div>
  )
}
