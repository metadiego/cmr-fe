"use client";

import * as React from "react";
import { useFormatter, useTranslations } from "next-intl";

import { getProducto } from "@/lib/api/inventario";
import { getReceipt, listReceipts, type Receipt, type ReceiptRow } from "@/lib/api/inventory-receipts";
import { last30Days, lineTotal, receiptTotals } from "@/lib/inventory/receipts";
import { parseDayUTC, todayPR } from "@/lib/format/fecha";
import { useResource } from "@/hooks/use-resource";
import { useCentroGate } from "@/hooks/use-centro-gate";
import { Button } from "@/components/ui/button";
import { DatePicker } from "@/components/ui/date-picker";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { PageContainer, PageHeader } from "@/components/ui/page";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableFooter, TableHead, TableHeader, TableRow } from "@/components/ui/table";

// «Recepciones»: every purchase reception as it was loaded — when, where, from whom, how many lines and
// units, cost and WHO loaded it — and «Ver» opens its lines (owner, 18-nov-2026; handoff
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
      <PageHeader title={t("title")} description={t("subtitle")} count={listRes.state.kind === "ok" ? t("count", { n: totals.receipts }) : undefined} />

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
        <div className="overflow-x-auto rounded-lg border">
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
                <TableHead className="text-right">{t("col.actions")}</TableHead>
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
                  <TableCell className="py-1 text-right">
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
                <TableCell colSpan={2} />
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
  const receipt = res.state.kind === "ok" ? res.state.data : null;

  // The receipt carries productId only: resolve names (a reception has a handful of lines).
  const ids = React.useMemo(() => [...new Set((receipt?.lines ?? []).map((l) => l.productId))], [receipt]);
  const namesRes = useResource<Record<string, { name: string; sku: string | null }>>(
    async () =>
      Object.fromEntries(
        await Promise.all(
          ids.map(async (id) => {
            try {
              const p = await getProducto(id);
              return [id, { name: String(p.name ?? id), sku: p.sku ?? null }] as const;
            } catch {
              return [id, { name: id, sku: null }] as const;
            }
          }),
        ),
      ),
    [ids.join(",")],
  );
  const names = namesRes.state.kind === "ok" ? namesRes.state.data : {};
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
        {receipt && (
          <div className="max-h-[70vh] overflow-auto rounded-lg border">
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
                  const p = names[l.productId];
                  const total = lineTotal(l.quantity, l.unitCost);
                  return (
                    <TableRow key={l.movementId ?? i}>
                      <TableCell>
                        <div>{p?.name ?? "…"}</div>
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
            </Table>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
