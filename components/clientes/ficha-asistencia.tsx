"use client";

import * as React from "react";
import { useTranslations, useFormatter } from "next-intl";

import { getPatientAttendance, type PatientAttendance } from "@/lib/api/statistics-analytics";
import { useResource } from "@/hooks/use-resource";
import { parseDayUTC } from "@/lib/format/fecha";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { EmptyState, ErrorState, LoadingPanel, Panel, RecordTable, Stat, StatGrid, Td, Th } from "@/components/kit/panel";

// Patient record, «Asistencia» tab (BE cmr-be#546, spec analytics-screens.md): visit history, therapy
// counts, upcoming appointments, packages and spend — all from ONE call, nothing recomputed here.
// Split into two sub-tabs: Visitas (attendance) and Compras (spend + packages).
const money = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" });
const dayFmt = new Intl.DateTimeFormat("en-US", { month: "2-digit", day: "2-digit", year: "numeric", timeZone: "UTC" });

export function FichaAsistencia({ pacienteId, centro }: { pacienteId: string; centro?: string }) {
  const t = useTranslations("reports.patientAttendanceTab");
  const tRoot = useTranslations();
  const format = useFormatter();
  const res = useResource<PatientAttendance>(() => getPatientAttendance(pacienteId, centro), [pacienteId, centro]);

  if (res.state.kind === "loading") return <LoadingPanel />;
  if (res.state.kind === "fail") return <ErrorState message={res.state.message} />;
  const d = res.state.data;
  const packages = d.packages ?? [];
  const maxMes = Math.max(1, ...d.visitsByMonth.map((m) => m.visits));

  // Two views of the same call: what the patient came for (visits) and what they bought (spend,
  // packages). Purchases still show for a patient with no recorded visits.
  return (
    <Tabs defaultValue="visits" className="gap-5">
      <TabsList>
        <TabsTrigger value="visits">{t("subTabVisits")}</TabsTrigger>
        <TabsTrigger value="purchases">{t("subTabPurchases")}</TabsTrigger>
      </TabsList>

      <TabsContent value="visits" className="space-y-6">
        {d.visits.total === 0 ? (
          <EmptyState bare>{t("empty")}</EmptyState>
        ) : (
          <>
            <Panel title={t("visitsSummaryTitle")}>
              <StatGrid>
                <Stat label={t("visitsTotal")} value={String(d.visits.total)} />
                <Stat label={t("visitsAppointments")} value={String(d.visits.appointments)} />
                <Stat label={t("visitsTherapies")} value={String(d.visits.therapies)} />
                <Stat label={t("visitsDays")} value={String(d.visits.days)} />
                <Stat label={t("firstVisit")} value={dia(d.firstVisit)} />
                <Stat label={t("lastVisit")} value={dia(d.lastVisit)} />
                <Stat label={t("avgDays")} value={d.avgDaysBetweenVisits != null ? d.avgDaysBetweenVisits.toFixed(1) : "—"} />
                <Stat label={t("noShows")} value={String(d.noShows)} tone={d.noShows > 0 ? "danger" : undefined} />
              </StatGrid>
              {(d.cancelled > 0 || d.unrecorded > 0) && (
                <div className="flex flex-wrap gap-4 border-t bg-muted/30 px-5 py-2.5 text-xs text-muted-foreground">
                  {d.cancelled > 0 && <span>{t("cancelled")}: <span className="tabular-nums">{d.cancelled}</span></span>}
                  {d.unrecorded > 0 && <span className="text-warning-foreground">{t("unrecorded")}: <span className="tabular-nums">{d.unrecorded}</span></span>}
                </div>
              )}
            </Panel>

            <Panel title={t("upcomingTitle")}>
              {d.upcoming.length === 0 ? (
                <EmptyState>{t("upcomingEmpty")}</EmptyState>
              ) : (
                <ul className="divide-y">
                  {d.upcoming.map((u, i) => (
                    <li key={i} className="flex flex-wrap items-center justify-between gap-x-4 gap-y-0.5 px-5 py-3 text-sm">
                      <span>
                        <span className="font-medium tabular-nums">{dia(u.date)}{u.time ? ` · ${u.time}` : ""}</span>
                        <span className="text-muted-foreground"> — {u.serviceName ?? tRoot(`reports.analytics.kind.${u.kind}`)}</span>
                      </span>
                      <span className="text-xs text-muted-foreground">{u.clinicName}{u.doctorName ? ` · ${u.doctorName}` : ""}</span>
                    </li>
                  ))}
                </ul>
              )}
            </Panel>

            {(d.therapies.length > 0 || d.visitsByMonth.some((m) => m.visits > 0)) && (
              <div className="grid gap-6 lg:grid-cols-2">
                {d.therapies.length > 0 && (
                  <Panel title={t("therapiesTitle")}>
                    <RecordTable
                      head={
                        <>
                          <Th>{t("col.service")}</Th>
                          <Th right>{t("col.sessions")}</Th>
                          <Th>{t("col.first")}</Th>
                          <Th>{t("col.last")}</Th>
                        </>
                      }
                    >
                      {d.therapies.map((th) => (
                        <tr key={th.service} className="hover:bg-muted/30">
                          <Td className="font-medium">{th.serviceName}</Td>
                          <Td className="text-right tabular-nums">{th.sessions}</Td>
                          <Td className="text-muted-foreground tabular-nums">{dia(th.first)}</Td>
                          <Td className="text-muted-foreground tabular-nums">{dia(th.last)}</Td>
                        </tr>
                      ))}
                    </RecordTable>
                  </Panel>
                )}
                {d.visitsByMonth.some((m) => m.visits > 0) && (
                  <Panel title={t("visitsByMonthTitle")}>
                    <div className="space-y-1.5 px-5 py-4">
                      {d.visitsByMonth.map((m) => (
                        <div key={m.month} className="flex items-center gap-2 text-xs">
                          <span className="w-20 shrink-0 text-muted-foreground">{mesLabel(m.month, format)}</span>
                          <div className="h-2 flex-1 overflow-hidden rounded-full bg-muted">
                            <div className="h-full rounded-full bg-primary" style={{ width: `${Math.max(2, Math.round((m.visits / maxMes) * 100))}%` }} />
                          </div>
                          <span className="w-6 shrink-0 text-right tabular-nums text-muted-foreground">{m.visits}</span>
                        </div>
                      ))}
                    </div>
                  </Panel>
                )}
              </div>
            )}
          </>
        )}
      </TabsContent>

      <TabsContent value="purchases" className="space-y-6">
        <Panel title={t("spendTitle")}>
          <StatGrid>
            <Stat label={t("col.invoices")} value={String(d.spend.invoices)} />
            <Stat label={t("col.gross")} value={money.format(d.spend.gross)} />
            <Stat label={t("col.refunds")} value={money.format(d.spend.refunds)} />
            <Stat label={t("col.net")} value={money.format(d.spend.net)} tone="primary" />
          </StatGrid>
        </Panel>

        <Panel title={t("packagesTitle")}>
          {packages.length === 0 ? (
            <EmptyState>{t("packagesEmpty")}</EmptyState>
          ) : (
            <RecordTable
              head={
                <>
                  <Th>{t("col.product")}</Th>
                  <Th right>{t("col.total")}</Th>
                  <Th right>{t("col.delivered")}</Th>
                  <Th right>{t("col.returned")}</Th>
                  <Th right>{t("col.transferred")}</Th>
                  <Th right>{t("col.remaining")}</Th>
                </>
              }
            >
              {packages.map((p) => (
                <tr key={p.productId} className="hover:bg-muted/30">
                  <Td className="font-medium">{p.productName}</Td>
                  <Td className="text-right tabular-nums">{p.total}</Td>
                  <Td className="text-right tabular-nums">{p.delivered}</Td>
                  <Td className="text-right tabular-nums">{p.returned}</Td>
                  <Td className="text-right tabular-nums">{p.transferred}</Td>
                  <Td className="text-right font-semibold tabular-nums">{p.remaining}</Td>
                </tr>
              ))}
            </RecordTable>
          )}
        </Panel>
      </TabsContent>
    </Tabs>
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
