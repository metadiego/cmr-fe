"use client";

import { useTranslations } from "next-intl";

import type { MissedReport } from "@/lib/api/callcenter";
import { Panel, EmptyState, RecordTable, Th, Td } from "@/components/kit/panel";

// Handoff §3: an hourly chart + a per-extension table, with the peak hour and the worst extension
// called out — the two numbers a manager actually scans for first.
export function CallcenterMissedReport({ report }: { report: MissedReport }) {
  const t = useTranslations("callcenter");
  const maxHour = Math.max(1, ...report.byHour.map((h) => h.missed));

  if (report.total === 0) {
    return <EmptyState>{t("missedEmpty")}</EmptyState>;
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        <div className="rounded-xl border bg-card p-4 shadow-xs">
          <p className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">{t("missedTotal")}</p>
          <p className="mt-1 text-xl font-semibold tabular-nums">{report.total}</p>
        </div>
        {report.peakHour && (
          <div className="rounded-xl border bg-card p-4 shadow-xs">
            <p className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">{t("missedPeakHour")}</p>
            <p className="mt-1 text-xl font-semibold tabular-nums">{t("hourlyTooltip", { hour: report.peakHour.hour, total: report.peakHour.missed })}</p>
          </div>
        )}
        {report.topExtension && (
          <div className="rounded-xl border bg-card p-4 shadow-xs">
            <p className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">{t("missedTopExtension")}</p>
            <p className="mt-1 text-xl font-semibold tabular-nums">
              {report.topExtension.staffName ?? report.topExtension.extension} ({report.topExtension.missed})
            </p>
          </div>
        )}
      </div>

      <Panel title={t("hourlyTitle")}>
        <div className="flex gap-1 px-5 py-4" style={{ height: 140 }}>
          {report.byHour.map((h) => (
            <div key={h.hour} className="flex min-w-0 flex-1 flex-col items-center gap-1" title={t("hourlyTooltip", { hour: h.hour, total: h.missed })}>
              <div className="flex w-full flex-1 items-end">
                <div className="w-full rounded-t bg-destructive/70" style={{ height: `${Math.max(2, (h.missed / maxHour) * 100)}%` }} />
              </div>
              <span className="text-[9px] text-muted-foreground tabular-nums">{h.hour % 3 === 0 ? h.hour : ""}</span>
            </div>
          ))}
        </div>
      </Panel>

      <Panel title={t("missedByExtensionTitle")}>
        <RecordTable
          head={
            <>
              <Th>{t("colExtension")}</Th>
              <Th>{t("colOperator")}</Th>
              <Th right>{t("missedColCount")}</Th>
            </>
          }
        >
          {report.byExtension.map((e) => (
            <tr key={e.extension}>
              <Td className="tabular-nums">{e.extension}</Td>
              <Td>{e.staffName ?? <span className="text-muted-foreground">{t("unassigned")}</span>}</Td>
              <Td className="text-right tabular-nums">{e.missed}</Td>
            </tr>
          ))}
        </RecordTable>
      </Panel>
    </div>
  );
}
