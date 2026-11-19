"use client"

import * as React from "react"
import { useFormatter, useTranslations } from "next-intl"

import { daySummaryExport, getDaySummary, rowRecord, type DaySummary, type DaySummaryRow } from "@/lib/api/day-summary"
import { getMyPreferences, setMyReportColumns } from "@/lib/api/preferences"
import { toastError } from "@/lib/api/errors"
import {
  DAY_SUMMARY_COLUMNS,
  DAY_SUMMARY_REPORT,
  groupDaySummary,
  savedReportColumns,
  toggleDaySummaryColumn,
  visibleDaySummaryColumns,
  type DaySummaryColumn,
  type DaySummaryGroup,
} from "@/lib/frontdesk/day-summary"
import { parseDayUTC } from "@/lib/format/fecha"
import { sumRows } from "@/lib/frontdesk/day-summary-filters"
import { ReportTableDialog } from "@/components/patient-desk/report-table-dialog"
import { useResource } from "@/hooks/use-resource"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"

const NUMERIC: ReadonlySet<DaySummaryColumn> = new Set(["quantity", "sealedVials", "content"])

// The day's summary of ONE service (owner 18-nov-2026): opened from the «Servicios» menu of the patient
// desk only when the service is complete (x/x). Letterhead + logo, the attended sessions, the totals
// (vials applied above all), columns the user chooses (saved in their preferences) and the common
// Imprimir / CSV / Email bar — all via the shared components/patient-desk/report-table-dialog.tsx shell,
// which the by-doctor summary (cmr-be #637) also builds on; CSV and Email go through the BE export engine
// (POST /export), so each one is logged in /export/jobs. Handoff docs/specs/resumen-del-dia-por-servicio-handoff.md
// (cmr-be #632).
export function DaySummaryDialog({
  open,
  onOpenChange,
  service,
  date,
  centerId,
  centerName,
}: {
  open: boolean
  onOpenChange: (v: boolean) => void
  service: { id: string; name: string }
  date: string
  centerId: string
  centerName: string
}) {
  const t = useTranslations("patientDesk.daySummary")
  const tRoot = useTranslations()
  const format = useFormatter()

  const res = useResource<DaySummary>(() => getDaySummary({ service: service.id, date, centerId }), [service.id, date, centerId])
  const prefs = useResource(() => getMyPreferences(), [])
  const [picked, setPicked] = React.useState<DaySummaryColumn[] | null>(null)
  const cols = picked ?? visibleDaySummaryColumns(prefs.state.kind === "ok" ? savedReportColumns(prefs.state.data.layers.user, DAY_SUMMARY_REPORT) : undefined)

  async function toggle(col: DaySummaryColumn) {
    const next = toggleDaySummaryColumn(cols, col)
    setPicked(next)
    try {
      await setMyReportColumns(DAY_SUMMARY_REPORT, next)
    } catch (err) {
      toastError(err, tRoot)
    }
  }

  const data = res.state.kind === "ok" ? res.state.data : null
  const num = (v: number | null | undefined, d = 0) =>
    v == null ? "—" : format.number(v, { minimumFractionDigits: d, maximumFractionDigits: 2 })
  const day = parseDayUTC(date)
  const dayText = day ? format.dateTime(day, "dayLong") : date
  const center = data?.centers.map((c) => c.name).join(", ") || centerName
  const title = t("title", { service: data?.service.name ?? service.name })
  const subtitle = `${dayText} · ${center}`

  const cell = (r: DaySummaryRow, c: DaySummaryColumn): React.ReactNode => {
    switch (c) {
      case "record":
        return <span className="font-mono">{rowRecord(r) ?? "—"}</span>
      case "patient":
        return r.patient ?? "—"
      case "quantity":
        return num(r.quantity)
      case "dose":
        return r.dose ?? "—"
      case "nurse":
        return r.nurse ?? "—"
      case "attendedBy":
        return r.attendedBy ?? "—"
      case "time":
        return r.attendedAt ? format.dateTime(new Date(r.attendedAt), "time") : "—"
      case "sealedVials":
        return num(r.sealedVials)
      case "content":
        return num(r.content)
    }
  }
  // What a cell SAYS, as text: the filters match against exactly what the user sees.
  const cellText = (r: DaySummaryRow, c: DaySummaryColumn): string => {
    switch (c) {
      case "record":
        return rowRecord(r) ?? "—"
      case "time":
        return r.attendedAt ? format.dateTime(new Date(r.attendedAt), "time") : "—"
      case "quantity":
      case "sealedVials":
      case "content":
        return num(r[c])
      default:
        return String((r as Record<string, unknown>)[c] ?? "—")
    }
  }

  return (
    <ReportTableDialog<DaySummaryRow, DaySummaryColumn>
      open={open}
      onOpenChange={onOpenChange}
      title={title}
      subtitle={subtitle}
      loading={res.state.kind === "loading"}
      failed={res.state.kind === "fail"}
      onRetry={res.reload}
      loadingText={tRoot("common.loading")}
      loadErrorText={t("loadError")}
      retryText={t("retry")}
      badge={
        data && (
          <span className={`rounded-full px-3 py-1 text-sm font-semibold tabular-nums ${data.complete ? "bg-success/15 text-success-foreground" : "bg-warning/15 text-warning-foreground"}`}>
            {data.attended}/{data.total}
          </span>
        )
      }
      topWarning={
        data &&
        !data.complete && <p className="no-print rounded-md bg-warning/10 px-3 py-2 text-sm text-warning-foreground">{t("notComplete", { attended: data.attended, total: data.total })}</p>
      }
      allColumns={DAY_SUMMARY_COLUMNS}
      columnLabel={(c) => t(`col.${c}`)}
      numericColumns={NUMERIC}
      visibleColumns={cols}
      onToggleColumn={(c) => void toggle(c)}
      columnsButtonLabel={t("columns")}
      columnsHint={t("columnsHint")}
      rows={data?.rows ?? []}
      rowKey={(r) => r.sessionId}
      cell={cell}
      cellText={cellText}
      footerTotal={(rows, c, filtering) => {
        const shown = filtering ? sumRows(rows) : data?.totals
        if (!shown) return null
        if (c === "quantity") return num(shown.quantity)
        if (c === "sealedVials") return num(shown.sealedVials)
        if (c === "content") return num(shown.content)
        return null
      }}
      totalsLabel={t("totals")}
      emptyText={t("empty")}
      filterNoneText={t("filter.none")}
      filterShowingText={(n, total) => t("filter.showing", { n, total })}
      filterClearText={t("filter.clear")}
      fileParts={[t("file"), data?.service.name ?? service.name, date]}
      exporter={(visibleRows, visibleCols, filterLabel) =>
        daySummaryExport({
          service: service.id,
          date,
          centerId,
          columns: visibleCols,
          ...(filterLabel ? { sessionIds: visibleRows.map((r) => r.sessionId), filterLabel } : {}),
        })
      }
    >
      {({ rows, filtering }) => {
        const shown = filtering ? sumRows(rows) : data?.totals
        const proportion =
          filtering
            ? data?.totals.proportion != null && data?.totals.content ? (shown!.content * data.totals.proportion) / data.totals.content : null
            : data?.totals.proportion
        if (!shown) return null
        return (
          <>
            <div className="grid gap-3 sm:grid-cols-4">
              <Stat label={t("stat.patients")} value={num(shown.patients)} sub={t("stat.sessions", { n: shown.sessions })} />
              <Stat label={t("stat.vials")} value={num(shown.sealedVials)} strong />
              <Stat label={t("stat.content")} value={num(shown.content)} />
              <Stat label={t("stat.proportion")} value={num(proportion, 2)} />
            </div>
            {rows.length > 0 && (
              <div className="grid gap-3 md:grid-cols-2">
                <Breakdown title={t("byNurse")} groups={(!filtering && data?.totals.byNurse) || groupDaySummary(rows, (r) => r.nurse)} />
                <Breakdown title={t("byUser")} groups={(!filtering && data?.totals.byUser) || groupDaySummary(rows, (r) => r.attendedBy)} />
              </div>
            )}
          </>
        )
      }}
    </ReportTableDialog>
  )
}

// Per nurse / per user (owner 18-nov-2026), from the BE's totals (cmr-be #634); the local grouping is only
// the fallback while an older BE answers without them. Inside the printed block, so the print carries it.
function Breakdown({ title, groups }: { title: string; groups: DaySummaryGroup[] }) {
  const t = useTranslations("patientDesk.daySummary")
  const format = useFormatter()
  const n = (v: number) => format.number(v, { maximumFractionDigits: 2 })
  return (
    <div className="overflow-hidden rounded-lg border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>{title}</TableHead>
            <TableHead className="w-24 text-right">{t("group.sessions")}</TableHead>
            <TableHead className="w-24 text-right">{t("col.sealedVials")}</TableHead>
            <TableHead className="w-24 text-right">{t("col.content")}</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {groups.map((g) => (
            <TableRow key={g.name ?? "—"}>
              <TableCell>{g.name ?? t("group.unknown")}</TableCell>
              <TableCell className="text-right tabular-nums">{n(g.sessions)}</TableCell>
              <TableCell className="text-right tabular-nums">{n(g.sealedVials)}</TableCell>
              <TableCell className="text-right tabular-nums">{n(g.content)}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  )
}

function Stat({ label, value, sub, strong }: { label: string; value: string; sub?: string; strong?: boolean }) {
  return (
    <div className={`rounded-lg border p-3 ${strong ? "border-primary bg-primary/5" : ""}`}>
      <div className="text-xs text-muted-foreground uppercase">{label}</div>
      <div className={`tabular-nums ${strong ? "text-2xl font-bold text-primary" : "text-xl font-semibold"}`}>{value}</div>
      {sub && <div className="text-xs text-muted-foreground">{sub}</div>}
    </div>
  )
}
