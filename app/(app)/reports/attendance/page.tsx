"use client";

import * as React from "react";
import { useTranslations, useFormatter } from "next-intl";
import { HugeiconsIcon } from "@hugeicons/react";
import { Download04Icon } from "@hugeicons/core-free-icons";

import { getAttendance, type Attendance, type AttendanceDimension } from "@/lib/api/statistics-analytics";
import { dimensionLabel, formatDimensionValue } from "@/lib/reports/analytics-format";
import { useResource } from "@/hooks/use-resource";
import { useReportClinics } from "@/hooks/use-report-clinics";
import { Button } from "@/components/ui/button";
import { DatePicker } from "@/components/ui/date-picker";
import { PageContainer, PageHeader } from "@/components/ui/page";
import { cn } from "@/lib/utils";

function isoDay(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
const nint = (v: number) => new Intl.NumberFormat("en-US").format(Number(v ?? 0));

const DIMENSIONS: AttendanceDimension[] = [
  "clinic", "day", "month", "weekday", "hour", "kind", "service", "doctor", "technician", "visitType", "channel", "status", "patient",
];

// Asistencia: citas y terapias por 1 a 3 cortes (BE cmr-be#546, spec analytics-screens.md). Mismo
// patrón de tabla plana que Ventas (components/.../sales-breakdown/page.tsx) — un corte principal,
// hasta 2 más.
export default function AsistenciaAnaliticaPage() {
  const t = useTranslations("reports.attendance");
  const td = useTranslations();
  const tRoot = useTranslations();
  const format = useFormatter();
  const clinics = useReportClinics("estadisticas.read");

  const hoy = new Date();
  const primero = new Date(hoy.getFullYear(), hoy.getMonth(), 1);
  const [desde, setDesde] = React.useState(isoDay(primero));
  const [hasta, setHasta] = React.useState(isoDay(hoy));
  const [by, setBy] = React.useState<AttendanceDimension[]>(["kind"]);
  const [query, setQuery] = React.useState<{ from: string; to: string; by: AttendanceDimension[] }>(
    { from: isoDay(primero), to: isoDay(hoy), by: ["kind"] },
  );

  function toggleDim(d: AttendanceDimension) {
    setBy((prev) => {
      if (prev.includes(d)) return prev.filter((x) => x !== d);
      if (prev.length >= 3) return prev;
      return [...prev, d];
    });
  }
  function buscar() {
    if (by.length === 0) return;
    setQuery({ from: desde, to: hasta, by });
  }

  const { state } = useResource<Attendance>(
    () => (clinics.ready && query.by.length > 0 ? getAttendance(query, clinics.choice) : new Promise<Attendance>(() => {})),
    [query, clinics.ready, clinics.choiceKey],
  );
  const data = state.kind === "ok" ? state.data : null;
  const rows = React.useMemo(() => data?.rows ?? [], [data]);

  function exportarCsv() {
    if (!data) return;
    const head = [
      ...query.by.map((d) => dimensionLabel(d, td)),
      t("col.events"), t("col.attended"), t("col.noShows"), t("col.cancelled"), t("col.scheduled"), t("col.unrecorded"), t("col.patients"), t("col.attendedPatients"),
    ];
    const lines = [head.join(",")];
    for (const r of rows) {
      lines.push([
        ...query.by.map((d) => csv(formatDimensionValue(d, r.group[d] ?? null, r.labels[d], format, td))),
        r.events, r.attended, r.noShows, r.cancelled, r.scheduled, r.unrecorded, r.patients, r.attendedPatients,
      ].join(","));
    }
    const blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `asistencia_${query.from}_${query.to}.csv`;
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
            <HugeiconsIcon icon={Download04Icon} className="size-4" /> {tRoot("reports.salesBreakdown.exportCsv")}
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
                  <th className="px-3 py-2 text-right font-semibold">{t("col.events")}</th>
                  <th className="px-3 py-2 text-right font-semibold text-foreground">{t("col.attended")}</th>
                  <th className="px-3 py-2 text-right font-semibold">{t("col.noShows")}</th>
                  <th className="px-3 py-2 text-right font-semibold">{t("col.cancelled")}</th>
                  <th className="px-3 py-2 text-right font-semibold">{t("col.scheduled")}</th>
                  <th className="px-3 py-2 text-right font-semibold">{t("col.unrecorded")}</th>
                  <th className="px-3 py-2 text-right font-semibold">{t("col.patients")}</th>
                  <th className="px-3 py-2 text-right font-semibold">{t("col.attendedPatients")}</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {rows.length === 0 && (
                  <tr><td colSpan={query.by.length + 7} className="px-3 py-10 text-center text-muted-foreground">{t("empty")}</td></tr>
                )}
                {rows.map((r, i) => (
                  <tr key={i} className="hover:bg-muted/30">
                    {query.by.map((d) => (
                      <td key={d} className="px-3 py-2 font-medium">{formatDimensionValue(d, r.group[d] ?? null, r.labels[d], format, td)}</td>
                    ))}
                    <td className="px-3 py-2 text-right tabular-nums text-muted-foreground">{nint(r.events)}</td>
                    <td className="px-3 py-2 text-right text-base font-bold tabular-nums">{nint(r.attended)}</td>
                    <td className="px-3 py-2 text-right tabular-nums text-muted-foreground">{nint(r.noShows)}</td>
                    <td className="px-3 py-2 text-right tabular-nums text-muted-foreground">{nint(r.cancelled)}</td>
                    <td className="px-3 py-2 text-right tabular-nums text-muted-foreground">{nint(r.scheduled)}</td>
                    <td className="px-3 py-2 text-right tabular-nums text-muted-foreground">{nint(r.unrecorded)}</td>
                    <td className="px-3 py-2 text-right tabular-nums text-muted-foreground">{nint(r.patients)}</td>
                    <td className="px-3 py-2 text-right tabular-nums text-muted-foreground">{nint(r.attendedPatients)}</td>
                  </tr>
                ))}
              </tbody>
              {rows.length > 0 && (
                <tfoot>
                  <tr className="border-t-2 bg-muted/40 font-semibold">
                    <td className="px-3 py-2" colSpan={query.by.length}>{clinics.withScope(t("totals"))}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{nint(data.total.events)}</td>
                    <td className="px-3 py-2 text-right text-base tabular-nums">{nint(data.total.attended)}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{nint(data.total.noShows)}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{nint(data.total.cancelled)}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{nint(data.total.scheduled)}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{nint(data.total.unrecorded)}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{nint(data.total.patients)}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{nint(data.total.attendedPatients)}</td>
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
