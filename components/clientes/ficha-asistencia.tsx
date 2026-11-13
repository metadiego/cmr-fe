"use client";

import * as React from "react";
import { useTranslations, useFormatter } from "next-intl";

import { getPatientAttendance, type PatientAttendance } from "@/lib/api/statistics-analytics";
import { useResource } from "@/hooks/use-resource";
import { parseDayUTC } from "@/lib/format/fecha";

// Patient record, «Asistencia» tab (BE cmr-be#546, spec analytics-screens.md): visit history, therapy
// counts, upcoming appointments, packages and spend — all from ONE call, nothing recomputed here.
const money = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" });
const dayFmt = new Intl.DateTimeFormat("en-US", { month: "2-digit", day: "2-digit", year: "numeric", timeZone: "UTC" });

export function FichaAsistencia({ pacienteId, centro }: { pacienteId: string; centro?: string }) {
  const t = useTranslations("reports.patientAttendanceTab");
  const tRoot = useTranslations();
  const format = useFormatter();
  const res = useResource<PatientAttendance>(() => getPatientAttendance(pacienteId, centro), [pacienteId, centro]);

  if (res.state.kind === "loading") return <p className="py-6 text-center text-sm text-muted-foreground">{tRoot("patients.hub.loading")}</p>;
  if (res.state.kind === "fail") return <p className="text-sm text-destructive">{res.state.message}</p>;
  const d = res.state.data;
  if (d.visits.total === 0) return <p className="rounded-md bg-muted/40 px-3 py-6 text-center text-sm text-muted-foreground">{t("empty")}</p>;

  const maxMes = Math.max(1, ...d.visitsByMonth.map((m) => m.visits));

  return (
    <div className="space-y-5">
      {/* Resumen */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat label={t("visitsTotal")} value={String(d.visits.total)} />
        <Stat label={t("visitsAppointments")} value={String(d.visits.appointments)} />
        <Stat label={t("visitsTherapies")} value={String(d.visits.therapies)} />
        <Stat label={t("visitsDays")} value={String(d.visits.days)} />
        <Stat label={t("firstVisit")} value={dia(d.firstVisit)} />
        <Stat label={t("lastVisit")} value={dia(d.lastVisit)} />
        <Stat label={t("avgDays")} value={d.avgDaysBetweenVisits != null ? d.avgDaysBetweenVisits.toFixed(1) : "—"} />
        <Stat label={t("noShows")} value={String(d.noShows)} warn={d.noShows > 0} />
      </div>
      {(d.cancelled > 0 || d.unrecorded > 0) && (
        <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
          {d.cancelled > 0 && <span>{t("cancelled")}: {d.cancelled}</span>}
          {d.unrecorded > 0 && <span className="text-warning-foreground">{t("unrecorded")}: {d.unrecorded}</span>}
        </div>
      )}

      {/* Terapias */}
      {d.therapies.length > 0 && (
        <section>
          <h3 className="mb-2 text-sm font-semibold">{t("therapiesTitle")}</h3>
          <div className="overflow-x-auto rounded-md bg-card ring-1 ring-foreground/10 shadow-sm shadow-[rgba(16,32,64,0.06)]">
            <table className="w-full text-sm">
              <thead className="bg-muted/40 text-xs text-muted-foreground">
                <tr>
                  <th className="px-3 py-2 text-left font-medium">{t("col.service")}</th>
                  <th className="px-3 py-2 text-right font-medium">{t("col.sessions")}</th>
                  <th className="px-3 py-2 text-left font-medium">{t("col.first")}</th>
                  <th className="px-3 py-2 text-left font-medium">{t("col.last")}</th>
                </tr>
              </thead>
              <tbody>
                {d.therapies.map((th) => (
                  <tr key={th.service} className="border-t">
                    <td className="px-3 py-2 font-medium">{th.serviceName}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{th.sessions}</td>
                    <td className="px-3 py-2 text-muted-foreground">{dia(th.first)}</td>
                    <td className="px-3 py-2 text-muted-foreground">{dia(th.last)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {/* Visitas por mes */}
      {d.visitsByMonth.some((m) => m.visits > 0) && (
        <section>
          <h3 className="mb-2 text-sm font-semibold">{t("visitsByMonthTitle")}</h3>
          <div className="space-y-1.5 rounded-md bg-card p-4 ring-1 ring-foreground/10 shadow-sm shadow-[rgba(16,32,64,0.06)]">
            {d.visitsByMonth.map((m) => (
              <div key={m.month} className="flex items-center gap-2 text-xs">
                <span className="w-20 shrink-0 text-muted-foreground">{mesLabel(m.month, format)}</span>
                <div className="h-2.5 flex-1 overflow-hidden rounded-full bg-muted">
                  <div className="h-full rounded-full bg-primary" style={{ width: `${Math.max(2, Math.round((m.visits / maxMes) * 100))}%` }} />
                </div>
                <span className="w-6 shrink-0 text-right tabular-nums text-muted-foreground">{m.visits}</span>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Próximas citas */}
      <section>
        <h3 className="mb-2 text-sm font-semibold">{t("upcomingTitle")}</h3>
        {d.upcoming.length === 0 ? (
          <p className="rounded-md bg-muted/40 px-3 py-4 text-center text-sm text-muted-foreground">{t("upcomingEmpty")}</p>
        ) : (
          <ul className="space-y-1.5">
            {d.upcoming.map((u, i) => (
              <li key={i} className="flex items-center justify-between rounded-md bg-card px-3 py-2 text-sm ring-1 ring-foreground/10">
                <span>{dia(u.date)}{u.time ? ` · ${u.time}` : ""} — {u.serviceName ?? tRoot(`reports.analytics.kind.${u.kind}`)}</span>
                <span className="text-xs text-muted-foreground">{u.clinicName}{u.doctorName ? ` · ${u.doctorName}` : ""}</span>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* Paquetes */}
      {(d.packages ?? []).length > 0 && (
        <section>
          <h3 className="mb-2 text-sm font-semibold">{t("packagesTitle")}</h3>
          <div className="overflow-x-auto rounded-md bg-card ring-1 ring-foreground/10 shadow-sm shadow-[rgba(16,32,64,0.06)]">
            <table className="w-full text-sm">
              <thead className="bg-muted/40 text-xs text-muted-foreground">
                <tr>
                  <th className="px-3 py-2 text-left font-medium">{t("col.product")}</th>
                  <th className="px-3 py-2 text-right font-medium">{t("col.total")}</th>
                  <th className="px-3 py-2 text-right font-medium">{t("col.delivered")}</th>
                  <th className="px-3 py-2 text-right font-medium">{t("col.returned")}</th>
                  <th className="px-3 py-2 text-right font-medium">{t("col.transferred")}</th>
                  <th className="px-3 py-2 text-right font-medium">{t("col.remaining")}</th>
                </tr>
              </thead>
              <tbody>
                {(d.packages ?? []).map((p) => (
                  <tr key={p.productId} className="border-t">
                    <td className="px-3 py-2 font-medium">{p.productName}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{p.total}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{p.delivered}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{p.returned}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{p.transferred}</td>
                    <td className="px-3 py-2 text-right font-semibold tabular-nums">{p.remaining}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {/* Gasto */}
      <section>
        <h3 className="mb-2 text-sm font-semibold">{t("spendTitle")}</h3>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Stat label={t("col.invoices")} value={String(d.spend.invoices)} />
          <Stat label={t("col.gross")} value={money.format(d.spend.gross)} />
          <Stat label={t("col.refunds")} value={money.format(d.spend.refunds)} />
          <Stat label={t("col.net")} value={money.format(d.spend.net)} strong />
        </div>
      </section>
    </div>
  );
}

function dia(iso: string | null): string {
  if (!iso) return "—";
  const d = parseDayUTC(iso);
  return d ? dayFmt.format(d) : iso;
}
function mesLabel(ym: string, format: ReturnType<typeof useFormatter>): string {
  const [y, m] = ym.split("-").map(Number);
  if (!y || !m) return ym;
  return format.dateTime(new Date(Date.UTC(y, m - 1, 1, 12)), "monthShort");
}

function Stat({ label, value, strong, warn }: { label: string; value: string; strong?: boolean; warn?: boolean }) {
  return (
    <div className="rounded-md bg-card p-3 ring-1 ring-foreground/10 shadow-sm shadow-[rgba(16,32,64,0.06)]">
      <div className="text-[11px] uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className={"mt-0.5 text-lg font-bold tabular-nums " + (warn ? "text-destructive" : strong ? "text-primary" : "")}>{value}</div>
    </div>
  );
}
