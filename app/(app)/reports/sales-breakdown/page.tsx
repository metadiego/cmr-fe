"use client";

import * as React from "react";
import { useTranslations, useFormatter } from "next-intl";
import { HugeiconsIcon } from "@hugeicons/react";
import { Download04Icon } from "@hugeicons/core-free-icons";

import { getSalesBreakdown, type SalesBreakdown, type SalesBreakdownDimension } from "@/lib/api/statistics-analytics";
import { dimensionLabel, formatDimensionValue } from "@/lib/reports/analytics-format";
import { useResource } from "@/hooks/use-resource";
import { useReportClinics } from "@/hooks/use-report-clinics";
import { Button } from "@/components/ui/button";
import { DatePicker } from "@/components/ui/date-picker";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { PageContainer, PageHeader } from "@/components/ui/page";
import { cn } from "@/lib/utils";

function isoDay(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
const money = (v: number) => `$${new Intl.NumberFormat("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(Number(v ?? 0))}`;
const nint = (v: number) => new Intl.NumberFormat("en-US").format(Number(v ?? 0));

// Las que se pueden combinar entre sí (el corte principal de "cuánto se facturó"). Hora y Forma de
// pago son lo COBRADO (pagos), no se combinan con Producto (el BE da 400 si se intenta).
const DIMENSIONS: SalesBreakdownDimension[] = [
  "clinic", "day", "month", "weekday", "hour", "doctor", "seller", "product", "patient", "source", "paymentMethod", "division",
];
const TODAS = "__todas__";

// Ventas: factura por 1 a 3 cortes a la vez (BE cmr-be#546, spec analytics-screens.md). Tabla plana
// (una fila por combinación que devuelve el BE) en vez de pivote filas×columnas: con hasta 3 cortes
// un pivote 2D no alcanza a representarlos a todos sin inventar una jerarquía que el handoff no pide.
export default function VentasAnaliticaPage() {
  const t = useTranslations("reports.salesBreakdown");
  const td = useTranslations();
  const tRoot = useTranslations();
  const format = useFormatter();
  const clinics = useReportClinics("estadisticas.read");

  const hoy = new Date();
  const primero = new Date(hoy.getFullYear(), hoy.getMonth(), 1);
  const [desde, setDesde] = React.useState(isoDay(primero));
  const [hasta, setHasta] = React.useState(isoDay(hoy));
  const [division, setDivision] = React.useState<string>(TODAS);
  const [by, setBy] = React.useState<SalesBreakdownDimension[]>(["seller"]);
  const [query, setQuery] = React.useState<{ from: string; to: string; contexto?: "general" | "consulta"; by: SalesBreakdownDimension[] }>(
    { from: isoDay(primero), to: isoDay(hoy), by: ["seller"] },
  );

  function toggleDim(d: SalesBreakdownDimension) {
    setBy((prev) => {
      if (prev.includes(d)) return prev.filter((x) => x !== d);
      if (prev.length >= 3) return prev;
      return [...prev, d];
    });
  }
  function buscar() {
    if (by.length === 0) return;
    setQuery({ from: desde, to: hasta, contexto: division === TODAS ? undefined : (division as "general" | "consulta"), by });
  }

  const { state } = useResource<SalesBreakdown>(
    () => (clinics.ready && query.by.length > 0 ? getSalesBreakdown(query, clinics.choice) : new Promise<SalesBreakdown>(() => {})),
    [query, clinics.ready, clinics.choiceKey],
  );
  const data = state.kind === "ok" ? state.data : null;
  const rows = React.useMemo(() => data?.rows ?? [], [data]);
  const showQuantity = by.includes("product");
  const maxNet = React.useMemo(() => rows.reduce((m, r) => Math.max(m, Math.abs(r.net)), 0), [rows]);

  function exportarCsv() {
    if (!data) return;
    const head = [...query.by.map((d) => dimensionLabel(d, td)), t("col.invoices"), t("col.patients"), t("col.gross"), t("col.refunds"), t("col.net")];
    if (showQuantity) head.push(t("col.quantity"));
    const lines = [head.join(",")];
    for (const r of rows) {
      const cells = [
        ...query.by.map((d) => csv(formatDimensionValue(d, r.group[d] ?? null, r.labels[d], format, td))),
        r.invoices, r.patients, r.gross, r.refunds, r.net,
      ];
      if (showQuantity) cells.push(r.quantity ?? 0);
      lines.push(cells.join(","));
    }
    const blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `ventas_${query.from}_${query.to}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <PageContainer>
      <PageHeader
        title={t("title")}
        description={t("help")}
        actions={
          <Button variant="outline" size="sm" onClick={exportarCsv} disabled={!data || rows.length === 0}>
            <HugeiconsIcon icon={Download04Icon} className="size-4" /> {t("exportCsv")}
          </Button>
        }
      />

      <div className="flex flex-wrap items-end gap-3 rounded-md bg-card ring-1 ring-foreground/10 shadow-sm shadow-[rgba(16,32,64,0.06)] p-4">
        <label className="flex flex-col gap-1.5">
          <span className="text-xs font-medium text-muted-foreground">{t("from")}</span>
          <DatePicker value={desde} onChange={setDesde} className="h-9 w-[160px]" />
        </label>
        <label className="flex flex-col gap-1.5">
          <span className="text-xs font-medium text-muted-foreground">{t("to")}</span>
          <DatePicker value={hasta} onChange={setHasta} className="h-9 w-[160px]" />
        </label>
        <label className="flex flex-col gap-1.5">
          <span className="text-xs font-medium text-muted-foreground">{dimensionLabel("division", td)}</span>
          <Select value={division} onValueChange={setDivision}>
            <SelectTrigger className="h-9 w-[160px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value={TODAS}>{tRoot("facturacion.ventasPorGrupo.div.todas")}</SelectItem>
              <SelectItem value="general">{tRoot("facturacion.ventasPorGrupo.div.general")}</SelectItem>
              <SelectItem value="consulta">{tRoot("facturacion.ventasPorGrupo.div.consulta")}</SelectItem>
            </SelectContent>
          </Select>
        </label>
        <Button onClick={buscar} className="h-9" disabled={by.length === 0}>{t("search")}</Button>
        {clinics.scopeLabel && (
          <div className="ml-auto self-center text-sm text-muted-foreground">{tRoot("reports.clinicScope.covers", { scope: clinics.scopeLabel })}</div>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-2 rounded-md bg-card ring-1 ring-foreground/10 shadow-sm shadow-[rgba(16,32,64,0.06)] p-4">
        <span className="text-xs font-medium text-muted-foreground">{t("cutBy")}</span>
        {DIMENSIONS.map((d) => (
          <button
            key={d}
            type="button"
            onClick={() => toggleDim(d)}
            className={cn(
              "rounded-full border px-3 py-1 text-xs font-medium transition-colors",
              by.includes(d) ? "border-primary bg-primary text-primary-foreground" : "border-foreground/15 text-muted-foreground hover:bg-muted",
            )}
          >
            {dimensionLabel(d, td)}
          </button>
        ))}
      </div>
      {by.length === 0 && <p className="text-sm text-destructive">{t("pickAtLeastOne")}</p>}

      {state.kind === "loading" && <p className="text-sm text-muted-foreground">{tRoot("common.loading")}</p>}
      {state.kind === "fail" && (
        <p className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">{state.message}</p>
      )}

      {data && (
        <>
          {data.truncated > 0 && (
            <p className="text-xs text-warning-foreground">{t("truncated", { n: data.truncated })}</p>
          )}
          <div className="overflow-x-auto rounded-md bg-card ring-1 ring-foreground/10 shadow-sm shadow-[rgba(16,32,64,0.06)]">
            <table className="w-full text-sm">
              <thead className="bg-muted/60">
                <tr className="border-b text-left text-[11px] uppercase tracking-wide text-muted-foreground">
                  {query.by.map((d) => <th key={d} className="px-3 py-2 font-semibold">{dimensionLabel(d, td)}</th>)}
                  <th className="px-3 py-2 text-right font-semibold">{t("col.invoices")}</th>
                  <th className="px-3 py-2 text-right font-semibold">{t("col.patients")}</th>
                  <th className="px-3 py-2 text-right font-semibold">{t("col.gross")}</th>
                  <th className="px-3 py-2 text-right font-semibold">{t("col.refunds")}</th>
                  <th className="px-3 py-2 text-right font-semibold text-foreground">{t("col.net")}</th>
                  {showQuantity && <th className="px-3 py-2 text-right font-semibold">{t("col.quantity")}</th>}
                </tr>
              </thead>
              <tbody className="divide-y">
                {rows.length === 0 && (
                  <tr><td colSpan={query.by.length + (showQuantity ? 6 : 5)} className="px-3 py-10 text-center text-muted-foreground">{t("empty")}</td></tr>
                )}
                {rows.map((r, i) => {
                  const pct = maxNet > 0 ? Math.max(2, Math.round((Math.abs(r.net) / maxNet) * 100)) : 0;
                  return (
                    <tr key={i} className="hover:bg-muted/30">
                      {query.by.map((d) => (
                        <td key={d} className="px-3 py-2 font-medium">
                          {formatDimensionValue(d, r.group[d] ?? null, r.labels[d], format, td)}
                          {d === query.by[0] && (
                            <div className="mt-1 h-1.5 w-full max-w-[160px] overflow-hidden rounded-full bg-muted">
                              <div className="h-full rounded-full bg-primary" style={{ width: `${pct}%` }} />
                            </div>
                          )}
                        </td>
                      ))}
                      <td className="px-3 py-2 text-right tabular-nums text-muted-foreground">{nint(r.invoices)}</td>
                      <td className="px-3 py-2 text-right tabular-nums text-muted-foreground">{nint(r.patients)}</td>
                      <td className="px-3 py-2 text-right tabular-nums text-muted-foreground">{money(r.gross)}</td>
                      <td className="px-3 py-2 text-right tabular-nums text-muted-foreground">{money(r.refunds)}</td>
                      <td className="px-3 py-2 text-right text-base font-bold tabular-nums">{money(r.net)}</td>
                      {showQuantity && <td className="px-3 py-2 text-right tabular-nums text-muted-foreground">{nint(r.quantity ?? 0)}</td>}
                    </tr>
                  );
                })}
              </tbody>
              {rows.length > 0 && (
                <tfoot>
                  <tr className="border-t-2 bg-muted/40 font-semibold">
                    <td className="px-3 py-2" colSpan={query.by.length}>{clinics.withScope(t("totals"))}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{nint(data.total.invoices)}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{nint(data.total.patients)}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{money(data.total.gross)}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{money(data.total.refunds)}</td>
                    <td className="px-3 py-2 text-right text-base tabular-nums">{money(data.total.net)}</td>
                    {showQuantity && <td className="px-3 py-2 text-right tabular-nums">{nint(data.total.quantity ?? 0)}</td>}
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

function csv(v: string | number): string {
  const s = String(v ?? "");
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}
