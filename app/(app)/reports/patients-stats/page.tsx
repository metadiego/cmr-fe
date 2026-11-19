"use client";

import * as React from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";

import { getPatientsStats, type PatientsStats } from "@/lib/api/statistics-analytics";
import { useResource } from "@/hooks/use-resource";
import { useReportClinics } from "@/hooks/use-report-clinics";
import { Button } from "@/components/ui/button";
import { DatePicker } from "@/components/ui/date-picker";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { PageContainer, PageHeader } from "@/components/ui/page";

function isoDay(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
const money = (v: number) => `$${new Intl.NumberFormat("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(Number(v ?? 0))}`;
const nint = (v: number) => new Intl.NumberFormat("en-US").format(Number(v ?? 0));
const dayFmt = new Intl.DateTimeFormat("en-US", { month: "2-digit", day: "2-digit", year: "numeric", timeZone: "UTC" });
function dia(iso: string | null): string {
  if (!iso) return "—";
  const m = iso.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!m) return iso;
  return dayFmt.format(new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]), 12)));
}

// Pacientes: visitas y gasto por paciente en el rango, más frecuentes/perdidos/nuevos (BE cmr-be#550,
// spec analytics-screens.md). El BE trunca (`truncated`) — no es la lista entera, es un vistazo.
export default function PacientesAnaliticaPage() {
  const t = useTranslations("reports.patientsStats");
  const tRoot = useTranslations();
  const clinics = useReportClinics("estadisticas.read");

  const hoy = new Date();
  const hace90 = new Date(hoy); hace90.setDate(hoy.getDate() - 90);
  const [desde, setDesde] = React.useState(isoDay(hace90));
  const [hasta, setHasta] = React.useState(isoDay(hoy));
  const [minVisits, setMinVisits] = React.useState("");
  const [lapsedDays, setLapsedDays] = React.useState("");
  const [newOnly, setNewOnly] = React.useState(false);
  const [query, setQuery] = React.useState({ from: isoDay(hace90), to: isoDay(hoy), minVisits: undefined as number | undefined, lapsedDays: undefined as number | undefined, newOnly: false });

  function buscar() {
    setQuery({
      from: desde,
      to: hasta,
      minVisits: minVisits.trim() ? Number(minVisits) : undefined,
      lapsedDays: lapsedDays.trim() ? Number(lapsedDays) : undefined,
      newOnly,
    });
  }

  const { state } = useResource<PatientsStats>(
    () => (clinics.ready ? getPatientsStats({ ...query, limit: 200 }, clinics.choice) : new Promise<PatientsStats>(() => {})),
    [query, clinics.ready, clinics.choiceKey],
  );
  const data = state.kind === "ok" ? state.data : null;
  const rows = data?.rows ?? [];
  const distTotal = data ? Object.values(data.distribution).reduce((a, b) => a + b, 0) : 0;

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
          <span className="text-xs font-medium text-muted-foreground">{t("minVisits")}</span>
          <Input type="number" min={0} className="h-9 w-[140px]" value={minVisits} onChange={(e) => setMinVisits(e.target.value)} />
        </label>
        <label className="flex flex-col gap-1.5">
          <span className="text-xs font-medium text-muted-foreground">{t("lapsedDays")}</span>
          <Input type="number" min={0} className="h-9 w-[140px]" value={lapsedDays} onChange={(e) => setLapsedDays(e.target.value)} />
        </label>
        <label className="flex items-center gap-2 pb-1.5">
          <Checkbox checked={newOnly} onCheckedChange={(v) => setNewOnly(!!v)} />
          <Label className="text-sm">{t("newOnly")}</Label>
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
          <div>
            <h3 className="mb-2 text-sm font-semibold">{t("distribution")}</h3>
            <div className="flex flex-wrap gap-2">
              {(Object.keys(data.distribution) as Array<keyof typeof data.distribution>).map((k) => {
                const n = data.distribution[k];
                const pct = distTotal > 0 ? Math.round((n / distTotal) * 100) : 0;
                return (
                  <div key={k} className="rounded-md bg-card px-3 py-2 ring-1 ring-foreground/10 shadow-sm shadow-[rgba(16,32,64,0.06)]">
                    <div className="text-[11px] uppercase tracking-wide text-muted-foreground">{k} ({pct}%)</div>
                    <div className="text-lg font-bold tabular-nums">{nint(n)}</div>
                  </div>
                );
              })}
            </div>
          </div>

          {data.truncated > 0 && (
            <p className="text-xs text-warning-foreground">{t("truncated", { shown: rows.length, total: data.patients })}</p>
          )}

          <div className="overflow-x-auto rounded-md bg-card ring-1 ring-foreground/10 shadow-sm shadow-[rgba(16,32,64,0.06)]">
            <table className="w-full text-sm">
              <thead className="bg-muted/60">
                <tr className="border-b text-left text-[11px] uppercase tracking-wide text-muted-foreground">
                  <th className="px-3 py-2 font-semibold">{t("col.patient")}</th>
                  <th className="px-3 py-2 text-right font-semibold">{t("col.visits")}</th>
                  <th className="px-3 py-2 text-right font-semibold">{t("col.therapies")}</th>
                  <th className="px-3 py-2 font-semibold">{t("col.firstVisit")}</th>
                  <th className="px-3 py-2 font-semibold">{t("col.lastVisit")}</th>
                  <th className="px-3 py-2 font-semibold">{t("col.nextVisit")}</th>
                  <th className="px-3 py-2 text-right font-semibold">{t("col.avgDays")}</th>
                  <th className="px-3 py-2 text-right font-semibold">{t("col.spend")}</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {rows.length === 0 && (
                  <tr><td colSpan={8} className="px-3 py-10 text-center text-muted-foreground">{t("empty")}</td></tr>
                )}
                {rows.map((r) => (
                  <tr key={r.patient} className="hover:bg-muted/30">
                    <td className="px-3 py-2">
                      <Link href={`/patients/${r.patient}`} className="font-medium text-primary hover:underline">{r.label}</Link>
                      {r.isNew && <span className="ml-1.5 rounded-full bg-success/15 px-1.5 py-0.5 text-[10px] text-success-foreground">{t("col.isNew")}</span>}
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums">{nint(r.visits)}</td>
                    <td className="px-3 py-2 text-right tabular-nums text-muted-foreground">{nint(r.therapies)}</td>
                    <td className="px-3 py-2 text-muted-foreground">{dia(r.firstVisit)}</td>
                    <td className="px-3 py-2 text-muted-foreground">{dia(r.lastVisit)}</td>
                    <td className="px-3 py-2 text-muted-foreground">{dia(r.nextVisit)}</td>
                    <td className="px-3 py-2 text-right tabular-nums text-muted-foreground">{r.avgDaysBetweenVisits != null ? r.avgDaysBetweenVisits.toFixed(1) : "—"}</td>
                    <td className="px-3 py-2 text-right text-base font-bold tabular-nums">{money(r.spend)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </PageContainer>
  );
}
