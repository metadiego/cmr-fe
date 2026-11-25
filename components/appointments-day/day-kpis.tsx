"use client"

import { useTranslations } from "next-intl"

import { Panel, Stat, StatGrid } from "@/components/kit/panel"
import { Skeleton } from "@/components/ui/skeleton"
import {
  dayKpis,
  todaySummary,
  type DayListRow,
} from "@/lib/appointments-day/day-list"

// The Citas screen's one row of numbers (owner, 25-nov): Citados / Confirmados / Presentes from the rows
// on screen (they follow every filter), plus Late / Upcoming only for today. Logic in
// lib/appointments-day/day-list.ts (`dayKpis`, `todaySummary`).
export function DayKpis({
  rows,
  nowHHmm,
}: {
  /** null while loading; a failed read shows "—". */
  rows: DayListRow[] | null | "fail"
  /** Center time when the day is today, else null (no Late / Upcoming). */
  nowHHmm: string | null
}) {
  const t = useTranslations("appointmentsDay.kpi")
  const loading = rows === null
  const data = Array.isArray(rows) ? rows : null
  const kpis = data ? dayKpis(data) : null
  const today = data && nowHHmm ? todaySummary(data, nowHHmm) : null
  const value = (n: number | undefined) =>
    loading ? (
      <Skeleton aria-hidden className="my-1 h-5 w-10" />
    ) : n === undefined ? (
      <span className="text-muted-foreground">—</span>
    ) : (
      n
    )

  return (
    <Panel>
      <div aria-busy={loading || undefined}>
        <StatGrid cols={nowHHmm ? 5 : 3}>
          <Stat label={t("booked")} value={value(kpis?.booked)} />
          <Stat label={t("confirmed")} value={value(kpis?.confirmed)} />
          <Stat
            label={t("arrived")}
            value={value(kpis?.arrived)}
            tone="primary"
          />
          {nowHHmm && (
            <>
              <Stat
                label={t("late")}
                value={value(today?.late)}
                tone={today && today.late > 0 ? "danger" : "muted"}
              />
              <Stat label={t("upcoming")} value={value(today?.upcoming)} />
            </>
          )}
        </StatGrid>
      </div>
    </Panel>
  )
}
