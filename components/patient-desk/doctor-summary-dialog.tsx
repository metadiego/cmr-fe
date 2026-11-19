"use client"

import * as React from "react"
import { useFormatter, useTranslations } from "next-intl"

import { doctorSummaryExport, getDoctorSummary, rowRecord, type DoctorSummary, type DoctorSummaryRow } from "@/lib/api/doctor-summary"
import { getMyPreferences, setMyReportColumns } from "@/lib/api/preferences"
import { toastError } from "@/lib/api/errors"
import { savedReportColumns } from "@/lib/frontdesk/day-summary"
import {
  DOCTOR_SUMMARY_COLUMNS,
  DOCTOR_SUMMARY_REPORT,
  toggleDoctorSummaryColumn,
  visibleDoctorSummaryColumns,
  type DoctorSummaryColumn,
} from "@/lib/frontdesk/doctor-summary"
import { money } from "@/lib/caja/totales"
import { parseDayUTC } from "@/lib/format/fecha"
import { ReportTableDialog } from "@/components/patient-desk/report-table-dialog"
import { useCan } from "@/hooks/use-can"
import { useResource } from "@/hooks/use-resource"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"

const NUMERIC: ReadonlySet<DoctorSummaryColumn> = new Set(["amount"])

// The day's consultations by doctor (owner 18-nov-2026): opened from the doctor-carried button next
// to "Médicos libres" on patient-desk → Consultas, either for every doctor or filtered to one. Same
// shell as the by-service summary (components/patient-desk/report-table-dialog.tsx) — "reutilizarlo,
// no copiarlo" — with its own columns, its own preference key, and breakdowns taken straight from the
// BE's `totals.byDoctor`/`totals.byType` rather than recomputed locally. Handoff
// docs/specs/resumen-por-medico-handoff-be.md (cmr-be #637).
//
// Always fetches the WHOLE day: a doctor clicked from the popover only PRESETS the Médico column's
// filter (owner, 18-nov-2026 — "si elige Todos que los muestre todos"), it never scopes the request,
// so picking "Todos" in that filter genuinely reveals every doctor instead of staying stuck on one.
export function DoctorSummaryDialog({
  open,
  onOpenChange,
  date,
  centerId,
  centerName,
  doctorName,
}: {
  open: boolean
  onOpenChange: (v: boolean) => void
  date: string
  centerId: string
  centerName: string
  /** Pre-selects the Médico filter to this doctor (clicked from the popover); omit to open unfiltered. */
  doctorName?: string
}) {
  const t = useTranslations("patientDesk.doctorSummary")
  const tDay = useTranslations("patientDesk.daySummary")
  const tRoot = useTranslations()
  const format = useFormatter()
  const { can } = useCan()
  const canReadInvoices = can("factura.read")

  // Always the whole day, every doctor (owner, 18-nov-2026: "Todos" in the Médico filter must show
  // every doctor, not just reveal nothing new — a doctor clicked from the popover only PRESETS that
  // column's filter, below, rather than narrowing what the BE sends).
  const res = useResource<DoctorSummary>(() => getDoctorSummary({ date, centerId }), [date, centerId])
  const prefs = useResource(() => getMyPreferences(), [])
  const [picked, setPicked] = React.useState<DoctorSummaryColumn[] | null>(null)
  const cols =
    picked ?? visibleDoctorSummaryColumns(prefs.state.kind === "ok" ? savedReportColumns(prefs.state.data.layers.user, DOCTOR_SUMMARY_REPORT) : undefined, canReadInvoices)
  const allowedColumns = canReadInvoices ? DOCTOR_SUMMARY_COLUMNS : DOCTOR_SUMMARY_COLUMNS.filter((c) => c !== "amount" && c !== "paymentMethod")

  async function toggle(col: DoctorSummaryColumn) {
    const next = toggleDoctorSummaryColumn(cols, col)
    setPicked(next)
    try {
      await setMyReportColumns(DOCTOR_SUMMARY_REPORT, next)
    } catch (err) {
      toastError(err, tRoot)
    }
  }

  const data = res.state.kind === "ok" ? res.state.data : null
  const day = parseDayUTC(date)
  const dayText = day ? format.dateTime(day, "dayLong") : date
  const title = doctorName ? t("titleDoctor", { doctor: doctorName }) : t("title")
  const subtitle = `${dayText} · ${centerName}`

  const cell = (r: DoctorSummaryRow, c: DoctorSummaryColumn): React.ReactNode => {
    switch (c) {
      case "record":
        return <span className="font-mono">{rowRecord(r) ?? "—"}</span>
      case "patient":
        return r.patient ?? "—"
      case "doctor":
        return r.doctor ?? "—"
      case "nurse":
        return r.nurse ?? "—"
      case "type":
        return r.type?.name ?? "—"
      case "time":
        return r.time ?? "—"
      case "frontDesk":
        return r.frontDesk ?? "—"
      case "amount":
        return r.invoiceAmount == null ? "—" : money(r.invoiceAmount)
      case "paymentMethod":
        return r.paymentMethods ?? "—"
    }
  }
  const cellText = (r: DoctorSummaryRow, c: DoctorSummaryColumn): string => {
    switch (c) {
      case "type":
        return r.type?.name ?? "—"
      case "amount":
        return r.invoiceAmount == null ? "—" : money(r.invoiceAmount)
      case "record":
        return rowRecord(r) ?? "—"
      // The BE's field is plural (paymentMethods); the generic fallback below reads properties by
      // the column's own name, so without this case it always read undefined and the filter/dropdown
      // for this column could never match what the cell actually shows.
      case "paymentMethod":
        return r.paymentMethods ?? "—"
      default:
        return String((r as unknown as Record<string, unknown>)[c] ?? "—")
    }
  }

  return (
    <ReportTableDialog<DoctorSummaryRow, DoctorSummaryColumn>
      open={open}
      onOpenChange={onOpenChange}
      title={title}
      subtitle={subtitle}
      loading={res.state.kind === "loading"}
      failed={res.state.kind === "fail"}
      onRetry={res.reload}
      loadingText={tRoot("common.loading")}
      loadErrorText={t("loadError")}
      retryText={tDay("retry")}
      allColumns={allowedColumns}
      columnLabel={(c) => t(`col.${c}`)}
      numericColumns={NUMERIC}
      visibleColumns={cols}
      onToggleColumn={(c) => void toggle(c)}
      columnsButtonLabel={tDay("columns")}
      columnsHint={tDay("columnsHint")}
      rows={data?.rows ?? []}
      rowKey={(r) => r.appointmentId}
      cell={cell}
      cellText={cellText}
      emptyText={t("empty")}
      filterNoneText={tDay("filter.none")}
      filterShowingText={(n, total) => tDay("filter.showing", { n, total })}
      filterClearText={tDay("filter.clear")}
      fileParts={[t("file"), centerName, date]}
      initialFilters={doctorName ? { doctor: doctorName } : undefined}
      exporter={(visibleRows, visibleCols, filterLabel) =>
        doctorSummaryExport({
          date,
          centerId,
          columns: visibleCols,
          ...(filterLabel ? { appointmentIds: visibleRows.map((r) => r.appointmentId), filterLabel } : {}),
        })
      }
    >
      {() =>
        data && (
          <div className="grid gap-3 md:grid-cols-2">
            <ByDoctor title={t("byDoctor")} rows={data.totals.byDoctor} />
            <ByType title={t("byType")} rows={data.totals.byType} />
          </div>
        )
      }
    </ReportTableDialog>
  )
}

// Straight from the BE's totals.byDoctor (cmr-be #637/#638) — not recomputed from what is on screen,
// per the handoff: the breakdown blocks always speak for the whole day, filtered or not. One column:
// the BE returns only attended appointments (cmr-be #638), so "carried"/waiting/in-consultation would
// only ever read the same number or zero — showing them invited staff to add them up against the type
// breakdown below and expect a different sum (owner, 18-nov-2026).
function ByDoctor({ title, rows }: { title: string; rows: DoctorSummary["totals"]["byDoctor"] }) {
  const t = useTranslations("patientDesk.doctorSummary")
  return (
    <div className="overflow-hidden rounded-lg border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>{title}</TableHead>
            <TableHead className="w-24 text-right">{t("attended")}</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((d) => (
            <TableRow key={d.doctorId ?? "—"}>
              <TableCell>{d.doctor ?? t("noDoctor")}</TableCell>
              <TableCell className="text-right tabular-nums font-semibold">{d.attended}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  )
}

function ByType({ title, rows }: { title: string; rows: DoctorSummary["totals"]["byType"] }) {
  const t = useTranslations("patientDesk.doctorSummary")
  return (
    <div className="overflow-hidden rounded-lg border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>{title}</TableHead>
            <TableHead className="w-20 text-right">{t("count")}</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((g) => (
            <TableRow key={g.slug}>
              <TableCell>{g.name}</TableCell>
              <TableCell className="text-right tabular-nums">{g.count}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  )
}
