// The "Todos los productos" kardex mode as CSV rows, in the same columns, grouping and order as the
// screen. Pure: the screen passes its translator and the exact groups it is showing (from
// visibleOverviewGroups in kardex-overview.ts); tested in kardex-overview-csv.test.ts.
import { overviewGroupLabel, type OverviewTableGroup } from "./kardex-overview.ts";

type T = {
  (key: string, values?: Record<string, string | number>): string;
  has: (key: string) => boolean;
};
type Row = (string | number)[];

export function overviewCsv(groups: OverviewTableGroup[], t: T): Row[] {
  const rows: Row[] = [
    [
      t("overview.col.sku"),
      t("overview.col.product"),
      t("overview.col.opening"),
      t("overview.col.inbound"),
      t("overview.col.applied"),
      t("overview.col.manualOutputs"),
      t("overview.col.adjustments"),
      t("overview.col.closing"),
      t("overview.col.pending"),
      t("overview.col.physical"),
      t("overview.col.freeStock"),
    ],
  ];
  for (const g of groups) {
    for (const p of g.products) {
      rows.push([
        p.sku,
        p.name,
        p.opening,
        p.inbound,
        p.applied,
        p.manualOutputs,
        p.adjustments,
        p.closing,
        p.pending,
        p.physical,
        p.freeStock,
      ]);
    }
    rows.push([
      overviewGroupLabel(g.deductionMode, t),
      "",
      g.totals.opening,
      g.totals.inbound,
      g.totals.applied,
      g.totals.manualOutputs,
      g.totals.adjustments,
      g.totals.closing,
      g.totals.pending,
      g.totals.physical,
      g.totals.freeStock,
    ]);
  }
  return rows;
}
