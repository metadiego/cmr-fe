"use client";

import { useTranslations } from "next-intl";

import type { CallBreakdown, CallStatistics } from "@/lib/api/callcenter";
import { formatMinSec } from "@/lib/comunicaciones/callcenter-dashboard";
import { Panel, StatGrid, Stat, RecordTable, Th, Td } from "@/components/kit/panel";

// Handoff §1: KPI row + cards by type (direction/channel) + an hourly chart + an operator table.
// No charting library exists in this app (confirmed before building) — the hourly chart is plain
// divs scaled against the busiest hour, not a canvas/SVG lib.
export function CallcenterStatsSection({ stats }: { stats: CallStatistics }) {
  const t = useTranslations("callcenter");

  // Fixed 6 cards, by the owner's own naming (handoff §1): Entrante/Saliente/Interno/Marypili come
  // from byDirection, Facebook/TV from byChannel — direction ALSO has a "facebook" value (its own
  // origin, not the channel dimension), so it is deliberately left out of the direction cards to
  // avoid double-counting the same calls under two different "Facebook" tiles.
  const zero: CallBreakdown = { total: 0, answered: 0, missed: 0, answerRate: 0, avgTalkSeconds: 0 };
  const byDirection = new Map(stats.byDirection.map((d) => [d.direction, d]));
  const byChannel = new Map(stats.byChannel.map((c) => [c.channel, c]));
  const cards: { key: string; label: string; data: CallBreakdown }[] = [
    { key: "entrante", label: t("direction.entrante"), data: byDirection.get("entrante") ?? zero },
    { key: "saliente", label: t("direction.saliente"), data: byDirection.get("saliente") ?? zero },
    { key: "interna", label: t("direction.interna"), data: byDirection.get("interna") ?? zero },
    { key: "facebook", label: t("channel.facebook"), data: byChannel.get("facebook") ?? zero },
    { key: "tv", label: t("channel.tv"), data: byChannel.get("tv") ?? zero },
    { key: "marypili", label: t("direction.marypili"), data: byDirection.get("marypili") ?? zero },
  ];

  const maxHour = Math.max(1, ...stats.byHour.map((h) => h.total));

  return (
    <div className="space-y-4">
      <Panel>
        <StatGrid cols={4}>
          <Stat label={t("kpiTotal")} value={stats.totals.total} />
          <Stat label={t("kpiAnswered")} value={`${stats.totals.answered} (${stats.totals.answerRate}%)`} tone="primary" />
          <Stat label={t("kpiMissed")} value={stats.totals.missed} tone={stats.totals.missed > 0 ? "danger" : undefined} />
          <Stat label={t("kpiAvgTalk")} value={formatMinSec(stats.totals.avgTalkSeconds)} />
        </StatGrid>
      </Panel>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        {cards.map((c) => (
          <div key={c.key} className="rounded-xl border bg-card p-4 shadow-xs">
            <p className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">{c.label}</p>
            <p className="mt-1 text-xl font-semibold tabular-nums">{c.data.total}</p>
            <p className="mt-0.5 text-xs text-muted-foreground">
              {t("cardBreakdown", { answered: c.data.answered, missed: c.data.missed, rate: c.data.answerRate })}
            </p>
          </div>
        ))}
      </div>

      <Panel title={t("hourlyTitle")}>
        <div className="flex gap-1 px-5 py-4" style={{ height: 140 }}>
          {stats.byHour.map((h) => (
            <div key={h.hour} className="flex min-w-0 flex-1 flex-col items-center gap-1" title={t("hourlyTooltip", { hour: h.hour, total: h.total })}>
              <div className="flex w-full flex-1 items-end">
                <div
                  className="w-full rounded-t bg-primary/70"
                  style={{ height: `${Math.max(2, (h.total / maxHour) * 100)}%` }}
                />
              </div>
              <span className="text-[9px] text-muted-foreground tabular-nums">{h.hour % 3 === 0 ? h.hour : ""}</span>
            </div>
          ))}
        </div>
      </Panel>

      <Panel title={t("operatorTitle")}>
        {stats.byOperator.length === 0 ? (
          <p className="px-5 py-8 text-center text-sm text-muted-foreground">{t("operatorEmpty")}</p>
        ) : (
          <RecordTable
            head={
              <>
                <Th>{t("colExtension")}</Th>
                <Th>{t("colOperator")}</Th>
                <Th right>{t("colTotal")}</Th>
                <Th right>{t("colAnswered")}</Th>
                <Th right>{t("colMissed")}</Th>
                <Th right>{t("colRate")}</Th>
                <Th right>{t("colAvgTalk")}</Th>
              </>
            }
          >
            {stats.byOperator.map((o) => (
              <tr key={o.extension}>
                <Td className="tabular-nums">{o.extension}</Td>
                <Td>{o.staffName ?? <span className="text-muted-foreground">{t("unassigned")}</span>}</Td>
                <Td className="text-right tabular-nums">{o.total}</Td>
                <Td className="text-right tabular-nums">{o.answered}</Td>
                <Td className="text-right tabular-nums">{o.missed}</Td>
                <Td className="text-right tabular-nums">{o.answerRate}%</Td>
                <Td className="text-right tabular-nums">{formatMinSec(o.avgTalkSeconds)}</Td>
              </tr>
            ))}
          </RecordTable>
        )}
      </Panel>
    </div>
  );
}
