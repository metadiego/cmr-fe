"use client";

import * as React from "react";
import { useTranslations, useFormatter } from "next-intl";

import { getReturnRate, type ReturnRate, type ReturnRateDimension } from "@/lib/api/statistics-analytics";
import { dimensionLabel, formatDimensionValue } from "@/lib/reports/analytics-format";
import { useResource } from "@/hooks/use-resource";
import { useReportClinics } from "@/hooks/use-report-clinics";
import { Button } from "@/components/ui/button";
import { DatePicker } from "@/components/ui/date-picker";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { PageContainer, PageHeader } from "@/components/ui/page";

function isoDay(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
const nint = (v: number) => new Intl.NumberFormat("en-US").format(Number(v ?? 0));
const pctFmt = new Intl.NumberFormat("en-US", { style: "percent", maximumFractionDigits: 1 });

const DIMENSIONS: ReturnRateDimension[] = ["clinic", "month", "service", "doctor", "kind"];
const NONE = "__none__";

// Tasa de retorno: de quienes terminaron su ventana, cuántos volvieron dentro de N días (BE
// cmr-be#550, spec analytics-screens.md). Un solo corte (no 1-3 como Ventas/Asistencia — así lo
// declara el contrato: `by` es un string, no una lista).
export default function TasaRetornoPage() {
  const t = useTranslations("reports.returnRate");
  const td = useTranslations();
  const tRoot = useTranslations();
  const format = useFormatter();
  const clinics = useReportClinics("estadisticas.read");

  const hoy = new Date();
  const hace180 = new Date(hoy); hace180.setDate(hoy.getDate() - 180);
  const [desde, setDesde] = React.useState(isoDay(hace180));
  const [hasta, setHasta] = React.useState(isoDay(hoy));
  const [withinDays, setWithinDays] = React.useState("60");
  const [by, setBy] = React.useState<string>(NONE);
  const [query, setQuery] = React.useState<{ from: string; to: string; withinDays: number; by?: ReturnRateDimension }>(
    { from: isoDay(hace180), to: isoDay(hoy), withinDays: 60 },
  );

  function buscar() {
    setQuery({ from: desde, to: hasta, withinDays: Number(withinDays) || 60, by: by === NONE ? undefined : (by as ReturnRateDimension) });
  }

  const { state } = useResource<ReturnRate>(
    () => (clinics.ready ? getReturnRate(query, clinics.choice) : new Promise<ReturnRate>(() => {})),
    [query, clinics.ready, clinics.choiceKey],
  );
  const data = state.kind === "ok" ? state.data : null;
  const rows = data?.rows ?? [];

  const rate = (v: number | null) => (v == null ? t("noRate") : pctFmt.format(v));

  return (
    <PageContainer>
      <PageHeader title={t("title")} description={t("help")} />

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
          <span className="text-xs font-medium text-muted-foreground">{t("withinDays")}</span>
          <Input type="number" min={1} className="h-9 w-[120px]" value={withinDays} onChange={(e) => setWithinDays(e.target.value)} />
        </label>
        <label className="flex flex-col gap-1.5">
          <span className="text-xs font-medium text-muted-foreground">{t("cutBy")}</span>
          <Select value={by} onValueChange={setBy}>
            <SelectTrigger className="h-9 w-[160px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value={NONE}>{t("none")}</SelectItem>
              {DIMENSIONS.map((d) => <SelectItem key={d} value={d}>{dimensionLabel(d, td)}</SelectItem>)}
            </SelectContent>
          </Select>
        </label>
        <Button onClick={buscar} className="h-9">{t("search")}</Button>
        {clinics.scopeLabel && (
          <div className="ml-auto self-center text-sm text-muted-foreground">{tRoot("reports.clinicScope.covers", { scope: clinics.scopeLabel })}</div>
        )}
      </div>

      {state.kind === "loading" && <p className="text-sm text-muted-foreground">{tRoot("common.loading")}</p>}
      {state.kind === "fail" && (
        <p className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">{state.message}</p>
      )}

      {data && (
        <>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Stat label={t("col.rate")} value={rate(data.total.rate)} strong />
            <Stat label={t("col.returned")} value={nint(data.total.returned)} />
            <Stat label={t("col.notReturned")} value={nint(data.total.notReturned)} />
            <Stat label={t("col.pending")} value={nint(data.total.pending)} />
            <Stat label={t("col.cohort")} value={nint(data.total.cohort)} />
            <Stat label={t("col.avgDays")} value={data.total.avgDaysToReturn != null ? data.total.avgDaysToReturn.toFixed(1) : "—"} />
          </div>

          {query.by && (
            <div className="overflow-x-auto rounded-md bg-card ring-1 ring-foreground/10 shadow-sm shadow-[rgba(16,32,64,0.06)]">
              <table className="w-full text-sm">
                <thead className="bg-muted/60">
                  <tr className="border-b text-left text-[11px] uppercase tracking-wide text-muted-foreground">
                    <th className="px-3 py-2 font-semibold">{dimensionLabel(query.by, td)}</th>
                    <th className="px-3 py-2 text-right font-semibold">{t("col.cohort")}</th>
                    <th className="px-3 py-2 text-right font-semibold">{t("col.returned")}</th>
                    <th className="px-3 py-2 text-right font-semibold">{t("col.notReturned")}</th>
                    <th className="px-3 py-2 text-right font-semibold">{t("col.pending")}</th>
                    <th className="px-3 py-2 text-right font-semibold text-foreground">{t("col.rate")}</th>
                    <th className="px-3 py-2 text-right font-semibold">{t("col.avgDays")}</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {rows.length === 0 && (
                    <tr><td colSpan={7} className="px-3 py-10 text-center text-muted-foreground">{t("empty")}</td></tr>
                  )}
                  {rows.map((r, i) => (
                    <tr key={i} className="hover:bg-muted/30">
                      <td className="px-3 py-2 font-medium">{formatDimensionValue(query.by!, r.group[query.by!] ?? null, r.labels[query.by!], format, td)}</td>
                      <td className="px-3 py-2 text-right tabular-nums text-muted-foreground">{nint(r.cohort)}</td>
                      <td className="px-3 py-2 text-right tabular-nums text-muted-foreground">{nint(r.returned)}</td>
                      <td className="px-3 py-2 text-right tabular-nums text-muted-foreground">{nint(r.notReturned)}</td>
                      <td className="px-3 py-2 text-right tabular-nums text-muted-foreground">{nint(r.pending)}</td>
                      <td className="px-3 py-2 text-right text-base font-bold tabular-nums">{rate(r.rate)}</td>
                      <td className="px-3 py-2 text-right tabular-nums text-muted-foreground">{r.avgDaysToReturn != null ? r.avgDaysToReturn.toFixed(1) : "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </PageContainer>
  );
}

function Stat({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className="rounded-md bg-card p-3 ring-1 ring-foreground/10 shadow-sm shadow-[rgba(16,32,64,0.06)]">
      <div className="text-[11px] uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className={"mt-0.5 text-lg font-bold tabular-nums " + (strong ? "text-primary" : "")}>{value}</div>
    </div>
  );
}
