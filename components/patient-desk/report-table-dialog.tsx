"use client"

import * as React from "react"
import { HugeiconsIcon } from "@hugeicons/react"
import { LayoutTable01Icon } from "@hugeicons/core-free-icons"

import type { ExportResult } from "@/lib/api/day-summary"
import { filterRows } from "@/lib/frontdesk/day-summary-filters"
import { DaySummaryFilterRow } from "@/components/patient-desk/day-summary-filter-row"
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

/**
 * The shared shell of every patient-desk "day summary" report: letterhead, a column-picker dropdown
 * backed by the viewer's preferences, per-column filters, the table itself, an optional footer-totals
 * row, and the Imprimir/CSV/Email bar — all generic over the row shape `R` and the column set `C`.
 * The day summary by service (cmr-be #632) and the one by doctor (cmr-be #637) both render through
 * THIS component; neither keeps its own copy, per the owner's "reutilizarlo, no copiarlo". Anything
 * below the table that is specific to one report (stats tiles, by-nurse/by-doctor breakdowns) is the
 * caller's `children`, given the currently-filtered rows so it can total them if it needs to.
 */
export function ReportTableDialog<R, C extends string>({
  open,
  onOpenChange,
  title,
  subtitle,
  loading,
  failed,
  onRetry,
  loadingText,
  loadErrorText,
  retryText,
  badge,
  topWarning,
  allColumns,
  columnLabel,
  numericColumns,
  visibleColumns,
  onToggleColumn,
  columnsButtonLabel,
  columnsHint,
  rows,
  rowKey,
  cell,
  cellText,
  footerTotal,
  totalsLabel,
  emptyText,
  filterNoneText,
  filterShowingText,
  filterClearText,
  fileParts,
  exporter,
  children,
}: {
  open: boolean
  onOpenChange: (v: boolean) => void
  title: string
  subtitle: string
  /** Still loading the data. */
  loading: boolean
  /** The fetch failed. */
  failed: boolean
  onRetry: () => void
  loadingText: string
  loadErrorText: string
  retryText: string
  /** The x/x "complete" pill some reports show next to the letterhead; omit for reports without one. */
  badge?: React.ReactNode
  /** A banner right under the letterhead, e.g. "this service is not complete yet"; omit if n/a. */
  topWarning?: React.ReactNode
  allColumns: readonly C[]
  columnLabel: (c: C) => string
  numericColumns: ReadonlySet<C>
  visibleColumns: readonly C[]
  onToggleColumn: (c: C) => void
  columnsButtonLabel: string
  columnsHint: string
  /** The report's full, UNFILTERED rows for this screen. */
  rows: readonly R[]
  rowKey: (r: R) => string
  cell: (r: R, c: C) => React.ReactNode
  /** What a cell SAYS, as text: filters and CSV/export columns match exactly what the user sees. */
  cellText: (r: R, c: C) => string
  /** The footer row under the table; omit the whole row by leaving this undefined. `filtering` lets a
   *  caller show the BE's own totals when nothing is filtered and a local sum only once it is. */
  footerTotal?: (rows: R[], c: C, filtering: boolean) => React.ReactNode
  /** Shown under the first non-numeric column of the footer row, once, in place of a number. */
  totalsLabel?: string
  emptyText: string
  filterNoneText: string
  filterShowingText: (n: number, total: number) => string
  filterClearText: string
  fileParts: string[]
  exporter: (visibleRows: R[], visibleCols: C[], filterLabel: string) => (format: "csv" | "pdf", channel: "download" | "email", destination?: string) => Promise<ExportResult>
  /** Whatever goes below the table (stats tiles, breakdowns) — given the filtered rows and whether a filter is active. */
  children?: (ctx: { rows: R[]; filtering: boolean }) => React.ReactNode
}) {
  const printRef = React.useRef<HTMLDivElement>(null)
  const [filters, setFilters] = React.useState<Record<string, string>>({})

  // Filters on columns the user has hidden still apply only while visible: hiding a column drops its filter.
  const activeFilters = Object.fromEntries(Object.entries(filters).filter(([c, v]) => v && visibleColumns.includes(c as C)))
  const filtering = Object.keys(activeFilters).length > 0
  const filteredRows = filterRows(rows, activeFilters, (r, c) => cellText(r, c as C))
  const filterLine = Object.entries(activeFilters)
    .map(([c, v]) => `${columnLabel(c as C)}: ${v}`)
    .join(" · ")

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
              <Button variant="outline" size="sm" disabled={loading}>
                <HugeiconsIcon icon={LayoutTable01Icon} className="size-4" /> {columnsButtonLabel}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuLabel>{columnsHint}</DropdownMenuLabel>
              <DropdownMenuSeparator />
              {allColumns.map((c) => (
                <DropdownMenuCheckboxItem
                  key={c}
                  checked={visibleColumns.includes(c)}
                  onSelect={(e) => e.preventDefault()}
                  onCheckedChange={() => onToggleColumn(c)}
                >
                  {columnLabel(c)}
                </DropdownMenuCheckboxItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
          <ReportActions
            target={printRef}
            title={title}
            subtitle={subtitle}
            fileParts={fileParts}
            disabled={loading || rows.length === 0}
            exporter={exporter([...filteredRows], [...visibleColumns], filtering ? filterLine : "")}
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
            {badge}
          </header>

          {loading && <p className="py-10 text-center text-sm text-muted-foreground">{loadingText}</p>}
          {failed && (
            <div className="py-10 text-center text-sm">
              <p className="text-destructive">{loadErrorText}</p>
              <Button variant="outline" size="sm" className="mt-2" onClick={onRetry}>
                {retryText}
              </Button>
            </div>
          )}

          {!loading && !failed && (
            <div ref={printRef} className="space-y-3">
              {filtering && (
                <div className="flex items-center gap-3 rounded-md bg-primary/5 px-3 py-2 text-sm">
                  <span className="flex-1">
                    {filterShowingText(filteredRows.length, rows.length)} · {filterLine}
                  </span>
                  <Button variant="ghost" size="sm" className="no-print" onClick={() => setFilters({})}>
                    {filterClearText}
                  </Button>
                </div>
              )}
              {topWarning}
              <div className="overflow-hidden rounded-lg border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-10">#</TableHead>
                      {visibleColumns.map((c) => (
                        <TableHead key={c} className={numericColumns.has(c) ? "text-right" : undefined}>
                          {columnLabel(c)}
                        </TableHead>
                      ))}
                    </TableRow>
                    {rows.length > 0 && (
                      <DaySummaryFilterRow
                        cols={visibleColumns}
                        rows={rows}
                        text={(r, c) => cellText(r, c as C)}
                        columnLabel={(c) => columnLabel(c as C)}
                        filters={filters}
                        onChange={(c, v) => setFilters((f) => ({ ...f, [c]: v }))}
                      />
                    )}
                  </TableHeader>
                  <TableBody>
                    {filteredRows.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={visibleColumns.length + 1} className="py-8 text-center text-muted-foreground">
                          {filtering ? filterNoneText : emptyText}
                        </TableCell>
                      </TableRow>
                    ) : (
                      filteredRows.map((r, i) => (
                        <TableRow key={rowKey(r)}>
                          <TableCell className="text-muted-foreground tabular-nums">{i + 1}</TableCell>
                          {visibleColumns.map((c) => (
                            <TableCell key={c} className={numericColumns.has(c) ? "text-right tabular-nums" : undefined}>
                              {cell(r, c)}
                            </TableCell>
                          ))}
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                  {footerTotal && filteredRows.length > 0 && (
                    <TableFooter>
                      <TableRow>
                        <TableCell />
                        {visibleColumns.map((c, i) => (
                          <TableCell key={c} className={numericColumns.has(c) ? "text-right font-semibold tabular-nums" : "font-semibold"}>
                            {footerTotal(filteredRows, c, filtering) ?? (totalsLabel && i === visibleColumns.findIndex((x) => !numericColumns.has(x)) ? totalsLabel : null)}
                          </TableCell>
                        ))}
                      </TableRow>
                    </TableFooter>
                  )}
                </Table>
              </div>

              {children?.({ rows: filteredRows, filtering })}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
