"use client"

import { useTranslations } from "next-intl"

import { distinctValues, filterKind } from "@/lib/frontdesk/day-summary-filters"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { TableHead, TableRow } from "@/components/ui/table"

const ALL = "__all__"

// The filter row under the summary's headers (owner 18-nov-2026): a box per typed column, a list of the
// day's values for the rest. Screen only: the print carries the result and a «Filtrado:» line instead.
export function DaySummaryFilterRow<R>({
  cols,
  rows,
  text,
  filters,
  onChange,
}: {
  cols: readonly string[]
  rows: readonly R[]
  text: (r: R, col: string) => string
  filters: Readonly<Record<string, string>>
  onChange: (col: string, value: string) => void
}) {
  const t = useTranslations("patientDesk.daySummary")
  return (
    <TableRow className="no-print hover:bg-transparent">
      <TableHead />
      {cols.map((c) => (
        <TableHead key={c} className="px-1 py-1">
          {filterKind(c) === "text" ? (
            <Input
              value={filters[c] ?? ""}
              onChange={(e) => onChange(c, e.target.value)}
              placeholder={t("filter.contains")}
              aria-label={t("filter.by", { col: t(`col.${c}`) })}
              className="h-7 text-xs font-normal"
            />
          ) : (
            <Select value={filters[c] || ALL} onValueChange={(v) => onChange(c, v === ALL ? "" : v)}>
              <SelectTrigger size="sm" className="h-7 w-full text-xs font-normal" aria-label={t("filter.by", { col: t(`col.${c}`) })}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL}>{t("filter.all")}</SelectItem>
                {distinctValues(rows, c, text).map((v) => (
                  <SelectItem key={v} value={v}>
                    {v}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </TableHead>
      ))}
    </TableRow>
  )
}
