"use client";

import * as React from "react";
import { useSearchParams } from "next/navigation";
import { useFormatter, useTranslations } from "next-intl";
import { HugeiconsIcon } from "@hugeicons/react";
import { PrinterIcon, Download04Icon } from "@hugeicons/core-free-icons";

import { getExoneratedProducts, type ExoneratedProductsReport } from "@/lib/api/exonerated-products";
import { componentAmount } from "@/lib/caja/product-sales";
import { dueTaxColumns, exoneratedCsvRows } from "@/lib/caja/exonerated-report";
import { toCsv } from "@/lib/caja/export";
import { money } from "@/lib/caja/totales";
import { parseDayUTC, todayPR } from "@/lib/format/fecha";
import { useResource } from "@/hooks/use-resource";
import { Button } from "@/components/ui/button";
import { DatePicker } from "@/components/ui/date-picker";
import { PageContainer, PageHeader } from "@/components/ui/page";

// «Productos exonerados de IVU» — month-end report for Accounting (legacy CMA repventasnoivu.php):
// product invoices that should have carried IVU and went out without it, with the IVU that was due
// per component (columns from the data). Per center (X-Tenant-ID; ?centro= overrides the active one).
// Presents BE numbers only. Permission factura.read (enforced by the BE).
export function ExoneratedProductsView() {
  const t = useTranslations("exoneratedProducts");
  const tc = useTranslations("common");
  const format = useFormatter();
  const centro = useSearchParams().get("centro") ?? undefined;

  const today = todayPR();
  const firstOfMonth = `${today.slice(0, 8)}01`;
  const [from, setFrom] = React.useState(firstOfMonth);
  const [to, setTo] = React.useState(today);
  const [query, setQuery] = React.useState({ from: firstOfMonth, to: today });

  const { state } = useResource<ExoneratedProductsReport>(
    () => getExoneratedProducts(query.from, query.to, centro),
    [query.from, query.to, centro],
  );
  const data = state.kind === "ok" ? state.data : null;
  const invoices = React.useMemo(() => data?.invoices ?? [], [data]);
  const cols = React.useMemo(() => dueTaxColumns(data?.totals.taxWouldBe, invoices), [data, invoices]);
  const day = (iso?: string) => {
    const d = parseDayUTC(iso);
    return d ? format.dateTime(d, "dayShort") : "—";
  };

  function previousMonth() {
    const [y, m] = today.split("-").map(Number);
    const py = m === 1 ? y - 1 : y;
    const pm = m === 1 ? 12 : m - 1;
    const last = new Date(Date.UTC(py, pm, 0)).getUTCDate();
    const f = `${py}-${String(pm).padStart(2, "0")}-01`;
    const l = `${py}-${String(pm).padStart(2, "0")}-${String(last).padStart(2, "0")}`;
    setFrom(f); setTo(l); setQuery({ from: f, to: l });
  }

  function exportCsv() {
    const rows = exoneratedCsvRows(invoices, cols, {
      number: t("col.number"), date: t("col.date"), record: t("col.record"), patient: t("col.patient"),
      subtotal: t("col.subtotal"), discount: t("col.discount"), shipping: t("col.shipping"), total: t("col.total"),
      exoneratedBase: t("col.exoneratedBase"), status: t("col.status"), payment: t("col.payment"),
    });
    const blob = new Blob([toCsv(rows)], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `exonerated-products_${query.from}_${query.to}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  const th = "px-3 py-2 font-semibold";
  return (
    <PageContainer className="w-full">
      <PageHeader
        title={t("title")}
        description={t("help")}
        actions={
          <div className="flex gap-2 no-print">
            <Button variant="outline" size="sm" onClick={exportCsv} disabled={invoices.length === 0}>
              <HugeiconsIcon icon={Download04Icon} className="size-4" /> {t("export")}
            </Button>
            <Button variant="outline" size="sm" onClick={() => window.print()} disabled={!data}>
              <HugeiconsIcon icon={PrinterIcon} className="size-4" /> {tc("print")}
            </Button>
          </div>
        }
      />

      <div className="flex flex-wrap items-end gap-3 rounded-md bg-card p-4 ring-1 ring-foreground/10 shadow-sm no-print">
        <label className="flex flex-col gap-1.5">
          <span className="text-xs font-medium text-muted-foreground">{t("from")}</span>
          <DatePicker value={from} onChange={setFrom} className="h-9 w-[160px]" />
        </label>
        <label className="flex flex-col gap-1.5">
          <span className="text-xs font-medium text-muted-foreground">{t("to")}</span>
          <DatePicker value={to} onChange={setTo} className="h-9 w-[160px]" />
        </label>
        <Button className="h-9" onClick={() => setQuery({ from, to })}>{t("search")}</Button>
        <Button variant="ghost" size="sm" className="h-9 text-xs" onClick={() => { setFrom(firstOfMonth); setTo(today); setQuery({ from: firstOfMonth, to: today }); }}>
          {t("thisMonth")}
        </Button>
        <Button variant="ghost" size="sm" className="h-9 text-xs" onClick={previousMonth}>{t("lastMonth")}</Button>
      </div>

      <p className="hidden text-sm print:block">{t("range", { from: day(query.from), to: day(query.to) })}</p>

      {state.kind === "loading" && <p className="text-sm text-muted-foreground">{tc("loading")}</p>}
      {state.kind === "fail" && (
        <p className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">{state.message}</p>
      )}

      {data && (
        <>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <Kpi label={t("kpi.invoices")} value={String(data.totals.invoices)} />
            <Kpi label={t("kpi.exoneratedBase")} value={money(data.totals.exoneratedBase)} />
            <Kpi label={t("kpi.taxWouldBe")} value={money(data.totals.taxWouldBe?.total ?? 0)} warn={(data.totals.taxWouldBe?.total ?? 0) > 0}>
              {cols.map((c) => (
                <div key={c.key} className="flex justify-between text-xs opacity-80">
                  <span>{c.name} {c.rate}%</span>
                  <span className="tabular-nums">{money(componentAmount(data.totals.taxWouldBe, c.key))}</span>
                </div>
              ))}
            </Kpi>
            <Kpi label={t("kpi.total")} value={money(data.totals.total)} />
          </div>

          <div className="overflow-x-auto rounded-md bg-card ring-1 ring-foreground/10 shadow-sm">
            <table className="w-full text-sm">
              <thead className="bg-muted/60">
                <tr className="border-b text-left text-[11px] uppercase tracking-wide text-muted-foreground">
                  <th className={th}>{t("col.number")}</th>
                  <th className={th}>{t("col.date")}</th>
                  <th className={th}>{t("col.record")}</th>
                  <th className={th}>{t("col.patient")}</th>
                  <th className={`${th} text-right`}>{t("col.subtotal")}</th>
                  <th className={`${th} text-right`}>{t("col.discount")}</th>
                  <th className={`${th} text-right`}>{t("col.shipping")}</th>
                  <th className={`${th} text-right`}>{t("col.total")}</th>
                  <th className={`${th} text-right`}>{t("col.exoneratedBase")}</th>
                  {cols.map((c) => <th key={c.key} className={`${th} text-right`}>{c.name}</th>)}
                  <th className={th}>{t("col.status")}</th>
                  <th className={th}>{t("col.payment")}</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {invoices.length === 0 && (
                  <tr><td colSpan={11 + cols.length} className="px-3 py-10 text-center text-muted-foreground">{t("empty")}</td></tr>
                )}
                {invoices.map((i) => (
                  <tr key={i.id} className="hover:bg-muted/30">
                    <td className="px-3 py-2 font-mono tabular-nums">{i.number || "—"}</td>
                    <td className="px-3 py-2 tabular-nums">{day(i.date)}</td>
                    <td className="px-3 py-2 tabular-nums text-muted-foreground">{i.medicalRecordNumber || ""}</td>
                    <td className="px-3 py-2">{i.patient || "—"}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{money(i.invoice?.subtotal ?? 0)}</td>
                    <td className="px-3 py-2 text-right tabular-nums text-muted-foreground">{money(i.invoice?.discount ?? 0)}</td>
                    <td className="px-3 py-2 text-right tabular-nums text-muted-foreground">{money(i.invoice?.shipping ?? 0)}</td>
                    <td className="px-3 py-2 text-right font-medium tabular-nums">{money(i.invoice?.total ?? 0)}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{money(i.exoneratedBase ?? 0)}</td>
                    {cols.map((c) => <td key={c.key} className="px-3 py-2 text-right tabular-nums">{money(componentAmount(i.taxWouldBe, c.key))}</td>)}
                    <td className="px-3 py-2 text-xs">{i.status || "—"}</td>
                    <td className="px-3 py-2 font-mono text-xs">{i.paymentMethods || "—"}</td>
                  </tr>
                ))}
              </tbody>
              {invoices.length > 0 && (
                <tfoot>
                  <tr className="border-t-2 bg-muted/40 font-semibold">
                    <td className="px-3 py-2" colSpan={4}>{t("totals", { n: data.totals.invoices })}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{money(data.totals.subtotal)}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{money(data.totals.discount)}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{money(data.totals.shipping)}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{money(data.totals.total)}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{money(data.totals.exoneratedBase)}</td>
                    {cols.map((c) => <td key={c.key} className="px-3 py-2 text-right tabular-nums">{money(componentAmount(data.totals.taxWouldBe, c.key))}</td>)}
                    <td colSpan={2} />
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
        </>
      )}
    </PageContainer>
  );
}

function Kpi({ label, value, warn, children }: { label: string; value: string; warn?: boolean; children?: React.ReactNode }) {
  return (
    <div className={"rounded-md px-4 py-3 ring-1 " + (warn ? "bg-warning text-warning-foreground ring-warning/40" : "bg-card ring-foreground/10 shadow-sm")}>
      <div className="text-[11px] font-semibold uppercase tracking-wide opacity-80">{label}</div>
      <div className="text-2xl font-bold tabular-nums">{value}</div>
      {children}
    </div>
  );
}
