"use client"

import * as React from "react"
import { useFormatter, useTranslations } from "next-intl"

import type { KardexOverview, KardexOverviewProduct } from "@/lib/api/inventory-kardex"
import {
  overviewGroupLabel,
  searchOverviewProducts,
  sortOverviewProducts,
  overviewGroupsForView,
  type OverviewSortKey,
  type OverviewTableGroup,
  type OverviewView,
} from "@/lib/inventory/kardex-overview"
import { SegmentedControl } from "@/components/kit/segmented-control"
import { EmptyState } from "@/components/kit/panel"
import { Input } from "@/components/ui/input"
import {
  Table,
  TableBody,
  TableCell,
  TableFooter,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"

const VIEWS: readonly OverviewView[] = ["together", "separated", "saleOnly", "deliveryOnly"]
const COLUMNS: readonly { key: OverviewSortKey; align?: "right" }[] = [
  { key: "sku" },
  { key: "name" },
  { key: "opening", align: "right" },
  { key: "inbound", align: "right" },
  { key: "applied", align: "right" },
  { key: "manualOutputs", align: "right" },
  { key: "adjustments", align: "right" },
  { key: "closing", align: "right" },
  { key: "pending", align: "right" },
  { key: "physical", align: "right" },
  { key: "freeStock", align: "right" },
]

// "Todos los productos": one screen over the whole catalog, split by deduction mode (cmr-be #699,
// handoff .personal/handoff-kardex-todos-los-productos.md). Owns its own view/search/sort so the
// screen (app/(app)/inventory/kardex) stays a thin host; it reports the rows it is CURRENTLY showing
// up via onVisibleGroupsChange so the page's CSV button exports exactly what is on screen.
export function KardexOverviewView({
  data,
  onOpenProduct,
  onVisibleGroupsChange,
}: {
  data: KardexOverview
  onOpenProduct: (productId: string) => void
  onVisibleGroupsChange?: (groups: OverviewTableGroup[]) => void
}) {
  const t = useTranslations("inventoryKardex")
  const format = useFormatter()
  const [view, setView] = React.useState<OverviewView>("together")
  const [query, setQuery] = React.useState("")
  const [sort, setSort] = React.useState<{ key: OverviewSortKey; dir: "asc" | "desc" }>({ key: "sku", dir: "asc" })

  const num = (v: number) => format.number(v, { maximumFractionDigits: 2 })
  const toggleSort = (key: OverviewSortKey) =>
    setSort((s) => (s.key === key ? { key, dir: s.dir === "asc" ? "desc" : "asc" } : { key, dir: "asc" }))

  const groups = React.useMemo<OverviewTableGroup[]>(
    () =>
      overviewGroupsForView(data, view).map((g) => ({
        ...g,
        products: sortOverviewProducts(searchOverviewProducts(g.products, query), sort.key, sort.dir),
      })),
    [data, view, query, sort],
  )
  React.useEffect(() => onVisibleGroupsChange?.(groups), [groups, onVisibleGroupsChange])

  const sortIndicator = (key: OverviewSortKey) => (sort.key === key ? (sort.dir === "asc" ? " ▲" : " ▼") : "")

  return (
    <div className="space-y-4">
      <div className="no-print flex flex-wrap items-end gap-3">
        <div className="flex min-w-72 flex-col gap-1">
          <SegmentedControl
            ariaLabel={t("overview.viewLabel")}
            value={view}
            onChange={setView}
            options={VIEWS.map((v) => ({ value: v, label: t(`overview.view.${v}`) }))}
          />
        </div>
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={t("overview.search")}
          className="w-64"
        />
      </div>

      {groups.every((g) => g.products.length === 0) ? (
        <EmptyState>{t("overview.empty")}</EmptyState>
      ) : (
        <div className="space-y-6">
          {groups.map((g) => (
            <div key={g.deductionMode ?? "all"} className="rounded-lg border">
              <Table>
                <TableHeader>
                  <TableRow>
                    {COLUMNS.map((c) => (
                      <TableHead
                        key={c.key}
                        className={c.align === "right" ? "cursor-pointer text-right" : "cursor-pointer"}
                        onClick={() => toggleSort(c.key)}
                      >
                        {t(`overview.col.${c.key}`)}
                        {sortIndicator(c.key)}
                      </TableHead>
                    ))}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {g.products.map((p) => (
                    <TableRow key={p.productId}>
                      <TableCell className="font-mono text-xs">
                        <button
                          type="button"
                          className="hover:underline"
                          onClick={() => onOpenProduct(p.productId)}
                        >
                          {p.sku}
                        </button>
                      </TableCell>
                      <TableCell>{p.name}</TableCell>
                      {(
                        [
                          "opening",
                          "inbound",
                          "applied",
                          "manualOutputs",
                          "adjustments",
                          "closing",
                          "pending",
                          "physical",
                          "freeStock",
                        ] as const
                      ).map((k) => (
                        <TableCell
                          key={k}
                          className={`text-right tabular-nums ${p[k] < 0 ? "text-destructive" : ""}`}
                        >
                          {num(p[k as keyof KardexOverviewProduct] as number)}
                        </TableCell>
                      ))}
                    </TableRow>
                  ))}
                </TableBody>
                <TableFooter>
                  <TableRow>
                    <TableCell colSpan={2} className="font-semibold">
                      {overviewGroupLabel(g.deductionMode, t)}
                    </TableCell>
                    {(
                      [
                        "opening",
                        "inbound",
                        "applied",
                        "manualOutputs",
                        "adjustments",
                        "closing",
                        "pending",
                        "physical",
                        "freeStock",
                      ] as const
                    ).map((k) => (
                      <TableCell key={k} className="text-right font-semibold tabular-nums">
                        {num(g.totals[k])}
                      </TableCell>
                    ))}
                  </TableRow>
                </TableFooter>
              </Table>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
