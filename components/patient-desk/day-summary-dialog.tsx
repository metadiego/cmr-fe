"use client"

import * as React from "react"
import { useFormatter, useTranslations } from "next-intl"
import { HugeiconsIcon } from "@hugeicons/react"
import { LayoutTable01Icon } from "@hugeicons/core-free-icons"

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
import { filterRows, sumRows } from "@/lib/frontdesk/day-summary-filters"
import { DaySummaryFilterRow } from "@/components/patient-desk/day-summary-filter-row"
import { useResource } from "@/hooks/use-resource"
import { ReportActions } from "@/components/reports/report-actions"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Table, TableBody, TableCell, TableFooter, TableHead, TableHeader, TableRow } from "@/components/ui/table"

const REPORT_LOGO = "/img/logo_cmr.png"
const NUMERIC: ReadonlySet<DaySummaryColumn> = new Set(["quantity", "sealedVials", "content"])

// The day's summary of ONE service (owner 18-nov-2026): opened from the «Servicios» menu of the patient
// desk only when the service is complete (x/x). Letterhead + logo, the attended sessions, the totals
// (vials applied above all), columns the user chooses (saved in their preferences) and the common
// Imprimir / CSV / Email bar; CSV and Email go through the BE export engine (POST /export), so each one
// is logged in /export/jobs. Handoff docs/specs/resumen-del-dia-por-servicio-handoff.md (cmr-be #632).
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
  const printRef = React.useRef<HTMLDivElement>(null)

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
  const [filters, setFilters] = React.useState<Record<string, string>>({})
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
  const cellText = (r: DaySummaryRow, c: string): string => {
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
  // Filters on columns the user has hidden still apply only while visible: hiding a column drops its filter.
  const activeFilters = Object.fromEntries(Object.entries(filters).filter(([c, v]) => v && cols.includes(c as DaySummaryColumn)))
  const filtering = Object.keys(activeFilters).length > 0
  const rows = data ? filterRows(data.rows, activeFilters, cellText) : []
  // Filtered, the footer, the stats and the breakdowns speak for the rows shown; unfiltered, the BE's totals.
  const shown = data && filtering ? sumRows(rows) : data?.totals
  const proportion =
    data && filtering ? (data.totals.proportion != null && data.totals.content ? (shown!.content * data.totals.proportion) / data.totals.content : null) : data?.totals.proportion
  const filterLine = Object.entries(activeFilters)
    .map(([c, v]) => `${t(`col.${c}`)}: ${v}`)
    .join(" · ")
  const total = (c: DaySummaryColumn): React.ReactNode => {
    if (!shown) return null
    if (c === "quantity") return num(shown.quantity)
    if (c === "sealedVials") return num(shown.sealedVials)
    if (c === "content") return num(shown.content)
    return null
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[92dvh] flex-col sm:max-w-6xl">
        <DialogHeader className="shrink-0">
          <DialogTitle className="sr-only">{title}</DialogTitle>
          <DialogDescription className="sr-only">{subtitle}</DialogDescription>
        </DialogHeader>
        <div className="flex flex-wrap items-center justify-end gap-2">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" disabled={!data}>
                <HugeiconsIcon icon={LayoutTable01Icon} className="size-4" /> {t("columns")}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuLabel>{t("columnsHint")}</DropdownMenuLabel>
              <DropdownMenuSeparator />
              {DAY_SUMMARY_COLUMNS.map((c) => (
                <DropdownMenuCheckboxItem
                  key={c}
                  checked={cols.includes(c)}
                  onSelect={(e) => e.preventDefault()}
                  onCheckedChange={() => void toggle(c)}
                >
                  {t(`col.${c}`)}
                </DropdownMenuCheckboxItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
          <ReportActions
            target={printRef}
            title={title}
            subtitle={subtitle}
            fileParts={[t("file"), data?.service.name ?? service.name, date]}
            disabled={!data || data.rows.length === 0}
            exporter={daySummaryExport({ service: service.id, date, centerId })}
          />
        </div>

        <div className="-mx-1 min-h-0 flex-1 overflow-y-auto px-1">
          {/* On screen the same letterhead the print and the PDF carry. */}
          <header className="no-print mb-3 flex items-center gap-4 border-b-2 border-primary pb-3">
            {/* eslint-disable-next-line @next/next/no-img-element -- fixed height, unknown aspect; the same static asset the print letterhead loads. */}
            <img src={REPORT_LOGO} alt="" className="h-12 w-auto object-contain" />
            <div className="min-w-0 flex-1">
              <h2 className="text-lg font-semibold text-primary">{title}</h2>
              <p className="text-sm text-muted-foreground">{subtitle}</p>
            </div>
            {data && (
              <span className={`rounded-full px-3 py-1 text-sm font-semibold tabular-nums ${data.complete ? "bg-success/15 text-success-foreground" : "bg-warning/15 text-warning-foreground"}`}>
                {data.attended}/{data.total}
              </span>
            )}
          </header>

          {res.state.kind === "loading" && <p className="py-10 text-center text-sm text-muted-foreground">{tRoot("common.loading")}</p>}
          {res.state.kind === "fail" && (
            <div className="py-10 text-center text-sm">
              <p className="text-destructive">{t("loadError")}</p>
              <Button variant="outline" size="sm" className="mt-2" onClick={res.reload}>
                {t("retry")}
              </Button>
            </div>
          )}

          {data && (
            <div ref={printRef} className="space-y-3">
              {filtering && (
                <div className="flex items-center gap-3 rounded-md bg-primary/5 px-3 py-2 text-sm">
                  <span className="flex-1">
                    {t("filter.showing", { n: rows.length, total: data.rows.length })} · {filterLine}
                  </span>
                  <Button variant="ghost" size="sm" className="no-print" onClick={() => setFilters({})}>
                    {t("filter.clear")}
                  </Button>
                </div>
              )}
              {!data.complete && <p className="no-print rounded-md bg-warning/10 px-3 py-2 text-sm text-warning-foreground">{t("notComplete", { attended: data.attended, total: data.total })}</p>}
              <div className="overflow-hidden rounded-lg border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-10">#</TableHead>
                      {cols.map((c) => (
                        <TableHead key={c} className={NUMERIC.has(c) ? "text-right" : undefined}>
                          {t(`col.${c}`)}
                        </TableHead>
                      ))}
                    </TableRow>
                    {data.rows.length > 0 && (
                      <DaySummaryFilterRow
                        cols={cols}
                        rows={data.rows}
                        text={cellText}
                        filters={filters}
                        onChange={(c, v) => setFilters((f) => ({ ...f, [c]: v }))}
                      />
                    )}
                  </TableHeader>
                  <TableBody>
                    {rows.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={cols.length + 1} className="py-8 text-center text-muted-foreground">
                          {filtering ? t("filter.none") : t("empty")}
                        </TableCell>
                      </TableRow>
                    ) : (
                      rows.map((r, i) => (
                        <TableRow key={r.sessionId}>
                          <TableCell className="text-muted-foreground tabular-nums">{i + 1}</TableCell>
                          {cols.map((c) => (
                            <TableCell key={c} className={NUMERIC.has(c) ? "text-right tabular-nums" : undefined}>
                              {cell(r, c)}
                            </TableCell>
                          ))}
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                  {rows.length > 0 && (
                    <TableFooter>
                      <TableRow>
                        <TableCell />
                        {cols.map((c) => (
                          <TableCell key={c} className={NUMERIC.has(c) ? "text-right font-semibold tabular-nums" : "font-semibold"}>
                            {total(c) ?? (c === cols.find((x) => !NUMERIC.has(x)) ? t("totals") : null)}
                          </TableCell>
                        ))}
                      </TableRow>
                    </TableFooter>
                  )}
                </Table>
              </div>

              <div className="grid gap-3 sm:grid-cols-4">
                <Stat label={t("stat.patients")} value={num(shown!.patients)} sub={t("stat.sessions", { n: shown!.sessions })} />
                <Stat label={t("stat.vials")} value={num(shown!.sealedVials)} strong />
                <Stat label={t("stat.content")} value={num(shown!.content)} />
                <Stat label={t("stat.proportion")} value={num(proportion, 2)} />
              </div>

              {rows.length > 0 && (
                <div className="grid gap-3 md:grid-cols-2">
                  <Breakdown title={t("byNurse")} groups={(!filtering && data.totals.byNurse) || groupDaySummary(rows, (r) => r.nurse)} />
                  <Breakdown title={t("byUser")} groups={(!filtering && data.totals.byUser) || groupDaySummary(rows, (r) => r.attendedBy)} />
                </div>
              )}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
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
