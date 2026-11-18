"use client";

import * as React from "react";
import { useFormatter, useTranslations } from "next-intl";

import { getAdjustment, listAdjustments, patientName, type AdjustmentDetail, type AdjustmentRow } from "@/lib/api/inventory-adjustments";
import { last30Days } from "@/lib/inventory/receipts";
import { parseDayUTC, todayPR } from "@/lib/format/fecha";
import { useResource } from "@/hooks/use-resource";
import { Button } from "@/components/ui/button";
import { DatePicker } from "@/components/ui/date-picker";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ReportActions } from "@/components/reports/report-actions";

// «Ajustes hechos»: one row per adjustment (number, date, warehouse, reason, patient, lines, net units,
// who loaded it), «Ver» opens its lines; the same Print / CSV bar and logo as the other reports.
export function AdjustmentsList({ centerId, centerName, reloadKey }: { centerId: string; centerName: string; reloadKey: number }) {
  const t = useTranslations("inventoryAdjustments");
  const tk = useTranslations("inventoryKardex");
  const format = useFormatter();
  const initial = React.useMemo(() => last30Days(todayPR()), []);
  const [from, setFrom] = React.useState(initial.from);
  const [to, setTo] = React.useState(initial.to);
  const [open, setOpen] = React.useState<AdjustmentRow | null>(null);
  const printRef = React.useRef<HTMLDivElement>(null);

  const res = useResource<AdjustmentRow[]>(() => listAdjustments({ from, to, centerId }), [from, to, centerId, reloadKey]);
  const rows = res.state.kind === "ok" ? res.state.data : [];
  const reasonText = (r: string | null) => (!r ? "—" : tk.has(`reason.${r}`) ? tk(`reason.${r}`) : r);
  const dayText = (d: string) => {
    const date = parseDayUTC(d.slice(0, 10));
    return date ? format.dateTime(date, "dayShort") : d;
  };
  const signed = (n: number) => `${n > 0 ? "+" : ""}${format.number(n)}`;

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="flex flex-wrap items-end gap-3">
          <div className="flex flex-col gap-1">
            <Label htmlFor="adj-from">{t("from")}</Label>
            <DatePicker id="adj-from" value={from} onChange={setFrom} />
          </div>
          <div className="flex flex-col gap-1">
            <Label htmlFor="adj-to">{t("to")}</Label>
            <DatePicker id="adj-to" value={to} onChange={setTo} />
          </div>
        </div>
        <ReportActions
          target={printRef}
          title={t("listTitle")}
          subtitle={`${centerName} · ${dayText(from)} – ${dayText(to)}`}
          disabled={rows.length === 0}
          fileParts={[t("listTitle"), centerName, from, to]}
          csv={() => [
            [t("col.number"), t("col.date"), t("warehouse"), t("reason"), t("patient"), t("col.lines"), t("col.net"), t("col.registeredBy"), t("notes")],
            ...rows.map((r) => [r.number ?? "", r.createdAt, r.warehouse ?? "", reasonText(r.reason), patientName(r.patient) ?? "", r.lines, r.netUnits, r.registeredBy ?? "", r.notes ?? ""]),
          ]}
        />
      </div>

      {res.state.kind === "loading" && <p className="text-sm text-muted-foreground">{t("loading")}</p>}
      {res.state.kind === "fail" && <p className="text-sm text-destructive">{res.state.message}</p>}
      {res.state.kind === "ok" && rows.length === 0 && <p className="text-sm text-muted-foreground">{t("empty")}</p>}

      {rows.length > 0 && (
        <div ref={printRef} className="overflow-x-auto rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t("col.number")}</TableHead>
                <TableHead>{t("col.date")}</TableHead>
                <TableHead>{t("warehouse")}</TableHead>
                <TableHead>{t("reason")}</TableHead>
                <TableHead>{t("patient")}</TableHead>
                <TableHead className="text-right">{t("col.lines")}</TableHead>
                <TableHead className="text-right">{t("col.net")}</TableHead>
                <TableHead>{t("col.registeredBy")}</TableHead>
                <TableHead className="no-print text-right">{t("col.actions")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((r) => (
                <TableRow key={r.documentId}>
                  <TableCell className="font-mono text-xs">{r.number ?? "—"}</TableCell>
                  <TableCell className="whitespace-nowrap tabular-nums">{format.dateTime(new Date(r.createdAt), "dateAndTime")}</TableCell>
                  <TableCell>{r.warehouse ?? "—"}</TableCell>
                  <TableCell>
                    <div>{reasonText(r.reason)}</div>
                    {r.notes && <div className="max-w-xs truncate text-xs text-muted-foreground" title={r.notes}>{r.notes}</div>}
                  </TableCell>
                  <TableCell>
                    {patientName(r.patient) ?? "—"}
                    {r.medicalRecordNumber && <span className="ml-1 text-xs text-muted-foreground">#{r.medicalRecordNumber}</span>}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">{format.number(r.lines)}</TableCell>
                  <TableCell className={`text-right font-medium tabular-nums ${r.netUnits < 0 ? "text-destructive" : ""}`}>{signed(r.netUnits)}</TableCell>
                  <TableCell>{r.registeredBy ?? "—"}</TableCell>
                  <TableCell className="no-print py-1 text-right">
                    <Button size="sm" variant="ghost" onClick={() => setOpen(r)}>{t("view")}</Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      <AdjustmentDialog row={open} onClose={() => setOpen(null)} centerName={centerName} reasonText={reasonText} />
    </div>
  );
}

function AdjustmentDialog({ row, onClose, centerName, reasonText }: { row: AdjustmentRow | null; onClose: () => void; centerName: string; reasonText: (r: string | null) => string }) {
  const t = useTranslations("inventoryAdjustments");
  const format = useFormatter();
  const printRef = React.useRef<HTMLDivElement>(null);
  const res = useResource<AdjustmentDetail | null>(() => (row ? getAdjustment(row.documentId, row.clinicId) : Promise.resolve(null)), [row?.documentId]);
  const d = res.state.kind === "ok" ? res.state.data : null;
  const subtitle = row
    ? [format.dateTime(new Date(row.createdAt), "dateAndTime"), centerName, row.warehouse, reasonText(row.reason), patientName(row.patient), row.registeredBy && t("by", { name: row.registeredBy })]
        .filter(Boolean)
        .join(" · ")
    : "";

  return (
    <Dialog open={!!row} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-4xl">
        <DialogHeader>
          <DialogTitle>{t("detailTitle", { number: row?.number ?? "" })}</DialogTitle>
          <DialogDescription>{subtitle}</DialogDescription>
        </DialogHeader>
        {res.state.kind === "loading" && <p className="text-sm text-muted-foreground">{t("loading")}</p>}
        {res.state.kind === "fail" && <p className="text-sm text-destructive">{res.state.message}</p>}
        {d && row && (
          <>
            <ReportActions
              target={printRef}
              title={t("detailTitle", { number: row.number ?? "" })}
              subtitle={subtitle}
              fileParts={[t("listTitle"), row.number ?? row.documentId.slice(0, 8)]}
              csv={() => [
                [t("product"), "SKU", t("quantity"), t("reason"), t("lot"), t("lineNote")],
                ...d.lines.map((l) => [l.product?.name ?? l.productId, l.product?.sku ?? "", l.signedQuantity, reasonText(l.reason), l.lotNumber ?? "", l.notes ?? ""]),
              ]}
            />
            <div ref={printRef} className="max-h-[65vh] overflow-auto rounded-lg border">
              {d.notes && <p className="border-b px-3 py-2 text-sm">{d.notes}</p>}
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t("product")}</TableHead>
                    <TableHead className="text-right">{t("quantity")}</TableHead>
                    <TableHead>{t("reason")}</TableHead>
                    <TableHead>{t("lot")}</TableHead>
                    <TableHead>{t("lineNote")}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {d.lines.map((l) => (
                    <TableRow key={l.movementId}>
                      <TableCell>
                        <div>{l.product?.name ?? l.productId}</div>
                        {l.product?.sku && <div className="font-mono text-xs text-muted-foreground">{l.product.sku}</div>}
                      </TableCell>
                      <TableCell className={`text-right tabular-nums ${l.signedQuantity < 0 ? "text-destructive" : ""}`}>
                        {l.signedQuantity > 0 ? "+" : ""}
                        {format.number(l.signedQuantity)}
                      </TableCell>
                      <TableCell>{reasonText(l.reason)}</TableCell>
                      <TableCell className="font-mono text-xs">{l.lotNumber ?? "—"}</TableCell>
                      <TableCell className="text-xs text-muted-foreground">{l.notes ?? ""}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
