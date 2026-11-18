"use client";

import * as React from "react";
import { useFormatter, useTranslations } from "next-intl";

import { getReceipt, listReceipts, type Receipt, type ReceiptRow } from "@/lib/api/inventory-receipts";
import { last30Days, lineTotal, receiptTotals } from "@/lib/inventory/receipts";
import { parseDayUTC, todayPR } from "@/lib/format/fecha";
import { useResource } from "@/hooks/use-resource";
import { useCentroGate } from "@/hooks/use-centro-gate";
import { Button } from "@/components/ui/button";
import { ReportActions } from "@/components/reports/report-actions";
import { DatePicker } from "@/components/ui/date-picker";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { PageContainer, PageHeader } from "@/components/ui/page";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableFooter, TableHead, TableHeader, TableRow } from "@/components/ui/table";

// «Recepciones»: every purchase reception as it was loaded — when, where, from whom, how many lines and
// units, cost and WHO loaded it — and «Ver» opens its lines (each with its product name and SKU from the BE) (owner, 18-nov-2026; handoff
// docs/specs/lista-de-recepciones-handoff.md). Read-only. USD pinned on purpose: digits only (rule 3b).
const USD = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" });
const ALL = "__all__";

export function ReceiptsList() {
  const t = useTranslations("inventoryReceipts");
  const format = useFormatter();
  const gate = useCentroGate();

  const initial = React.useMemo(() => last30Days(todayPR()), []);
  const [from, setFrom] = React.useState(initial.from);
  const [to, setTo] = React.useState(initial.to);
  const [centerPick, setCenterPick] = React.useState<string | null>(null);
  const center = centerPick ?? gate.centro ?? ALL;
  const centerId = center === ALL ? null : center;
  const [open, setOpen] = React.useState<ReceiptRow | null>(null);
  const printRef = React.useRef<HTMLDivElement>(null);

  const listRes = useResource<ReceiptRow[]>(() => listReceipts({ from, to, centerId }), [from, to, centerId]);
  const rows = listRes.state.kind === "ok" ? listRes.state.data : [];
  const totals = receiptTotals(rows);
  const centerName = (id: string, fallback?: string | null) => fallback || gate.centros.find((c) => c.id === id)?.name || "—";
  const dayText = (d: string | null) => {
    const date = d ? parseDayUTC(d.slice(0, 10)) : null;
    return date ? format.dateTime(date, "dayShort") : "—";
  };

  return (
    <PageContainer className="w-full">
      <PageHeader
        title={t("title")}
        description={t("subtitle")}
        count={listRes.state.kind === "ok" ? t("count", { n: totals.receipts }) : undefined}
        actions={
          <ReportActions
            target={printRef}
            title={t("title")}
            subtitle={`${centerId ? centerName(centerId) : t("allCenters")} · ${dayText(from)} – ${dayText(to)}`}
            disabled={rows.length === 0}
            fileParts={[t("title"), from, to]}
            csv={() => [
              [t("col.date"), t("col.center"), t("col.supplier"), t("col.invoice"), t("col.lines"), t("col.units"), t("col.cost"), t("col.registeredBy")],
              ...rows.map((r) => [r.createdAt, [centerName(r.clinicId, r.clinicName), r.warehouse].filter(Boolean).join(" · "), r.supplier ?? "", r.purchaseInvoiceNumber ?? "", r.lines, r.units, r.totalCost ?? "", r.registeredBy ?? ""]),
            ]}
          />
        }
      />

      <div className="flex flex-wrap items-end gap-3">
        {gate.centros.length > 1 && (
          <div className="flex flex-col gap-1">
            <Label>{t("center")}</Label>
            <Select value={center} onValueChange={setCenterPick}>
              <SelectTrigger className="h-9 w-52"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL}>{t("allCenters")}</SelectItem>
                {gate.centros.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        )}
        <div className="flex flex-col gap-1">
          <Label htmlFor="receipts-from">{t("from")}</Label>
          <DatePicker id="receipts-from" value={from} onChange={setFrom} />
        </div>
        <div className="flex flex-col gap-1">
          <Label htmlFor="receipts-to">{t("to")}</Label>
          <DatePicker id="receipts-to" value={to} onChange={setTo} />
        </div>
      </div>

      {listRes.state.kind === "loading" && <p className="text-sm text-muted-foreground">{t("loading")}</p>}
      {listRes.state.kind === "fail" && <p className="text-sm text-destructive">{listRes.state.message}</p>}
      {listRes.state.kind === "ok" && rows.length === 0 && <p className="text-sm text-muted-foreground">{t("empty")}</p>}

      {rows.length > 0 && (
        <div ref={printRef} className="overflow-x-auto rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t("col.date")}</TableHead>
                <TableHead>{t("col.center")}</TableHead>
                <TableHead>{t("col.supplier")}</TableHead>
                <TableHead>{t("col.invoice")}</TableHead>
                <TableHead className="text-right">{t("col.lines")}</TableHead>
                <TableHead className="text-right">{t("col.units")}</TableHead>
                <TableHead className="text-right">{t("col.cost")}</TableHead>
                <TableHead>{t("col.registeredBy")}</TableHead>
                <TableHead className="no-print text-right">{t("col.actions")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((r) => (
                <TableRow key={r.documentId}>
                  <TableCell className="whitespace-nowrap tabular-nums">
                    {format.dateTime(new Date(r.createdAt), "dateAndTime")}
                    {r.effectiveDate && r.effectiveDate.slice(0, 10) !== r.createdAt.slice(0, 10) && (
                      <div className="text-xs text-muted-foreground">{t("effective", { date: dayText(r.effectiveDate) })}</div>
                    )}
                  </TableCell>
                  <TableCell>
                    <div>{centerName(r.clinicId, r.clinicName)}</div>
                    {r.warehouse && <div className="text-xs text-muted-foreground">{r.warehouse}</div>}
                  </TableCell>
                  <TableCell>{r.supplier || "—"}</TableCell>
                  <TableCell className="font-mono text-xs">{r.purchaseInvoiceNumber || "—"}</TableCell>
                  <TableCell className="text-right tabular-nums">{format.number(r.lines)}</TableCell>
                  <TableCell className="text-right tabular-nums">{format.number(r.units)}</TableCell>
                  <TableCell className="text-right tabular-nums">{r.totalCost == null ? "" : USD.format(r.totalCost)}</TableCell>
                  <TableCell>{r.registeredBy || "—"}</TableCell>
                  <TableCell className="no-print py-1 text-right">
                    <Button size="sm" variant="ghost" onClick={() => setOpen(r)}>
                      {t("view")}
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
            <TableFooter>
              <TableRow>
                <TableCell colSpan={4} className="font-semibold">{t("total")}</TableCell>
                <TableCell className="text-right font-semibold tabular-nums">{format.number(totals.lines)}</TableCell>
                <TableCell className="text-right font-semibold tabular-nums">{format.number(totals.units)}</TableCell>
                <TableCell className="text-right font-semibold tabular-nums">{totals.totalCost == null ? "" : USD.format(totals.totalCost)}</TableCell>
                <TableCell /><TableCell className="no-print" />
              </TableRow>
            </TableFooter>
          </Table>
        </div>
      )}

      <ReceiptDialog row={open} onClose={() => setOpen(null)} centerLabel={open ? centerName(open.clinicId, open.clinicName) : ""} />
    </PageContainer>
  );
}

function ReceiptDialog({ row, onClose, centerLabel }: { row: ReceiptRow | null; onClose: () => void; centerLabel: string }) {
  const t = useTranslations("inventoryReceipts");
  const format = useFormatter();
  const res = useResource<Receipt | null>(() => (row ? getReceipt(row.documentId, row.clinicId) : Promise.resolve(null)), [row?.documentId]);
  const printRef = React.useRef<HTMLDivElement>(null);
  const receipt = res.state.kind === "ok" ? res.state.data : null;

  const dayText = (d: string | null) => {
    const date = d ? parseDayUTC(d.slice(0, 10)) : null;
    return date ? format.dateTime(date, "dayShort") : "—";
  };

  return (
    <Dialog open={!!row} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-5xl">
        <DialogHeader>
          <DialogTitle>
            {t("detailTitle")}
            {row?.purchaseInvoiceNumber ? ` · ${row.purchaseInvoiceNumber}` : ""}
          </DialogTitle>
          {row && (
            <DialogDescription>
              {[format.dateTime(new Date(row.createdAt), "dateAndTime"), centerLabel, row.warehouse, row.supplier, row.registeredBy && t("by", { name: row.registeredBy })]
                .filter(Boolean)
                .join(" · ")}
            </DialogDescription>
          )}
        </DialogHeader>
        {res.state.kind === "loading" && <p className="text-sm text-muted-foreground">{t("loading")}</p>}
        {res.state.kind === "fail" && <p className="text-sm text-destructive">{res.state.message}</p>}
        {receipt && row && (
          <ReportActions
            target={printRef}
            title={[t("detailTitle"), row.purchaseInvoiceNumber].filter(Boolean).join(" · ")}
            subtitle={[format.dateTime(new Date(row.createdAt), "dateAndTime"), centerLabel, row.warehouse, row.supplier, row.registeredBy && t("by", { name: row.registeredBy })].filter(Boolean).join(" · ")}
            fileParts={[t("detailTitle"), row.purchaseInvoiceNumber || row.documentId.slice(0, 8), row.createdAt.slice(0, 10)]}
            csv={() => [
              [t("line.product"), "SKU", t("line.quantity"), t("line.unitCost"), t("line.total"), t("line.lot"), t("line.expires"), t("line.notes")],
              ...receipt.lines.map((l) => [l.product?.name ?? l.productId, l.product?.sku ?? "", l.quantity, l.unitCost ?? "", lineTotal(l.quantity, l.unitCost) ?? "", l.lotNumber ?? "", l.expirationDate?.slice(0, 10) ?? "", l.notes ?? ""]),
            ]}
          />
        )}
        {receipt && (
          <div ref={printRef} className="max-h-[70vh] overflow-auto rounded-lg border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t("line.product")}</TableHead>
                  <TableHead className="text-right">{t("line.quantity")}</TableHead>
                  <TableHead className="text-right">{t("line.unitCost")}</TableHead>
                  <TableHead className="text-right">{t("line.total")}</TableHead>
                  <TableHead>{t("line.lot")}</TableHead>
                  <TableHead>{t("line.expires")}</TableHead>
                  <TableHead>{t("line.notes")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {receipt.lines.map((l, i) => {
                  const p = l.product;
                  const total = lineTotal(l.quantity, l.unitCost);
                  return (
                    <TableRow key={l.movementId ?? i}>
                      <TableCell>
                        <div>{p?.name ?? l.productId}</div>
                        {p?.sku && <div className="font-mono text-xs text-muted-foreground">{p.sku}</div>}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">{format.number(l.quantity)}</TableCell>
                      <TableCell className="text-right tabular-nums">{l.unitCost == null ? "" : USD.format(l.unitCost)}</TableCell>
                      <TableCell className="text-right tabular-nums">{total == null ? "" : USD.format(total)}</TableCell>
                      <TableCell className="font-mono text-xs">{l.lotNumber || "—"}</TableCell>
                      <TableCell className="tabular-nums">{dayText(l.expirationDate)}</TableCell>
                      <TableCell className="max-w-xs text-xs text-muted-foreground">{l.notes ?? ""}</TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
              <TableFooter>
                <TableRow>
                  <TableCell className="font-semibold">{t("total")}</TableCell>
                  <TableCell className="text-right font-semibold tabular-nums">{format.number(receipt.lines.reduce((a, l) => a + l.quantity, 0))}</TableCell>
                  <TableCell />
                  <TableCell className="text-right font-semibold tabular-nums">
                    {(() => {
                      const costs = receipt.lines.map((l) => lineTotal(l.quantity, l.unitCost)).filter((v): v is number => v != null);
                      return costs.length ? USD.format(costs.reduce((a, v) => a + v, 0)) : "";
                    })()}
                  </TableCell>
                  <TableCell colSpan={3} />
                </TableRow>
              </TableFooter>
            </Table>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
