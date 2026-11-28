"use client"

import { useTranslations } from "next-intl"

import type { KardexPurchasesRefunds } from "@/lib/api/inventory-kardex"
import { channelText, undatedLegacyText } from "@/lib/inventory/purchases-refunds"
import { formatFechaSolo } from "@/lib/format/fecha"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { EmptyState, Panel, StatGrid, Stat } from "@/components/kit/panel"
import {
  Table,
  TableBody,
  TableCell,
  TableFooter,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"

// "Compras y devoluciones" (handoff kardex-compras-y-devoluciones, cmr-be "kardex purchases-refunds",
// 28-nov-2026): a FIXED photo of the period, generic for any product — the owner's own words, "una
// nueva tab genérica que sirva para todos". Every row the BE sends is already dated; nothing here
// re-derives a month, unlike "Control de entregas".
export function KardexPurchasesRefundsView({ data }: { data: KardexPurchasesRefunds }) {
  const t = useTranslations("inventoryKardex")
  const dayText = (d: string) => formatFechaSolo(d) || d
  const undatedWarning = undatedLegacyText(data, t)

  return (
    <div className="space-y-4">
      {undatedWarning && (
        <Alert variant="warning">
          <AlertDescription>{undatedWarning}</AlertDescription>
        </Alert>
      )}

      <Panel title={t("purchasesRefunds.sectionPurchases")}>
        {data.purchases.length === 0 ? (
          <EmptyState>{t("purchasesRefunds.emptyPurchases")}</EmptyState>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t("purchasesRefunds.col.date")}</TableHead>
                <TableHead>{t("purchasesRefunds.col.record")}</TableHead>
                <TableHead>{t("purchasesRefunds.col.patient")}</TableHead>
                <TableHead>{t("purchasesRefunds.col.invoice")}</TableHead>
                <TableHead>{t("purchasesRefunds.col.channel")}</TableHead>
                <TableHead className="text-right">{t("purchasesRefunds.col.quantity")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.purchases.map((p, i) => (
                <TableRow key={`${p.invoiceNumber ?? ""}-${i}`}>
                  <TableCell className="tabular-nums">{dayText(p.date)}</TableCell>
                  <TableCell className="tabular-nums">{p.recordNumber ?? "—"}</TableCell>
                  <TableCell>{p.patientName ?? "—"}</TableCell>
                  <TableCell className="font-mono text-xs">{p.invoiceNumber ?? "—"}</TableCell>
                  <TableCell>{channelText(p, t)}</TableCell>
                  <TableCell className="text-right tabular-nums">{p.quantity}</TableCell>
                </TableRow>
              ))}
            </TableBody>
            <TableFooter>
              <TableRow>
                <TableCell colSpan={5} className="font-semibold">{t("purchasesRefunds.totalPurchased")}</TableCell>
                <TableCell className="text-right font-bold tabular-nums">{data.totals.purchased}</TableCell>
              </TableRow>
            </TableFooter>
          </Table>
        )}
      </Panel>

      <Panel title={t("purchasesRefunds.sectionRefunds")}>
        {data.refunds.length === 0 ? (
          <EmptyState>{t("purchasesRefunds.emptyRefunds")}</EmptyState>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t("purchasesRefunds.col.date")}</TableHead>
                <TableHead>{t("purchasesRefunds.col.refundNumber")}</TableHead>
                <TableHead>{t("purchasesRefunds.col.invoice")}</TableHead>
                <TableHead>{t("purchasesRefunds.col.record")}</TableHead>
                <TableHead>{t("purchasesRefunds.col.patient")}</TableHead>
                <TableHead className="text-right">{t("purchasesRefunds.col.quantity")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.refunds.map((r, i) => (
                <TableRow key={`${r.refundNumber ?? ""}-${i}`}>
                  <TableCell className="tabular-nums">{dayText(r.date)}</TableCell>
                  <TableCell className="font-mono text-xs">{r.refundNumber ?? "—"}</TableCell>
                  <TableCell className="font-mono text-xs">{r.invoiceNumber ?? "—"}</TableCell>
                  <TableCell className="tabular-nums">{r.recordNumber ?? "—"}</TableCell>
                  <TableCell>{r.patientName ?? "—"}</TableCell>
                  <TableCell className="text-right tabular-nums">
                    {r.quantity}
                    {r.viaKit && <span className="ml-1.5 text-xs text-muted-foreground">({t("purchasesRefunds.viaKit")})</span>}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
            <TableFooter>
              <TableRow>
                <TableCell colSpan={5} className="font-semibold">{t("purchasesRefunds.totalRefunded")}</TableCell>
                <TableCell className="text-right font-bold tabular-nums">{data.totals.refunded}</TableCell>
              </TableRow>
            </TableFooter>
          </Table>
        )}
      </Panel>

      <Panel title={t("purchasesRefunds.totalsTitle")}>
        <StatGrid cols={3}>
          <Stat label={t("purchasesRefunds.totalPurchased")} value={data.totals.purchased} />
          <Stat label={t("purchasesRefunds.totalRefunded")} value={data.totals.refunded} />
          <Stat label={t("purchasesRefunds.totalNet")} value={data.totals.net} />
        </StatGrid>
      </Panel>
    </div>
  )
}
