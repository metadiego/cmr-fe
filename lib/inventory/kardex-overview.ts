// Pure helpers of the "Todos los productos" kardex mode (app/(app)/inventory/kardex). Tested in
// kardex-overview.test.ts. Grouping, search and sort live here so both the screen and its CSV export
// (kardex-overview-csv.ts) build the exact same rows from the exact same logic.

import type {
  KardexOverview,
  KardexOverviewProduct,
} from "@/lib/api/inventory-kardex";

export type OverviewView = "together" | "separated" | "saleOnly" | "deliveryOnly";

export const DEDUCTION_MODE_SALE = "a_la_venta";
export const DEDUCTION_MODE_DELIVERY = "a_la_entrega";

export type OverviewSortKey =
  | "sku"
  | "name"
  | "opening"
  | "inbound"
  | "applied"
  | "manualOutputs"
  | "adjustments"
  | "closing"
  | "pending"
  | "physical"
  | "freeStock";

export type OverviewTableGroup = {
  /** null only for the combined "together" table, which has no single deduction mode. */
  deductionMode: string | null;
  totals: KardexOverview["totals"];
  products: KardexOverviewProduct[];
};

/**
 * The product groups a view shows: "together" is one table over everything, "separated" is one table
 * per BE group (in the BE's own order), and the "…Only" views keep just the matching BE group. Always
 * built from `data.groups`/`data.totals`, never recomputed client-side, so a screen total always
 * matches the BE's arithmetic.
 */
export function overviewGroupsForView(data: KardexOverview, view: OverviewView): OverviewTableGroup[] {
  const byId = new Map(data.products.map((p) => [p.productId, p]));
  const fromBeGroups = (modes: readonly string[]) =>
    data.groups
      .filter((g) => modes.includes(g.deductionMode))
      .map((g) => ({
        deductionMode: g.deductionMode,
        totals: g.totals,
        products: g.productIds
          .map((id) => byId.get(id))
          .filter((p): p is KardexOverviewProduct => !!p),
      }));
  switch (view) {
    case "together":
      return [{ deductionMode: null, totals: data.totals, products: data.products }];
    case "separated":
      return fromBeGroups(data.groups.map((g) => g.deductionMode));
    case "saleOnly":
      return fromBeGroups([DEDUCTION_MODE_SALE]);
    case "deliveryOnly":
      return fromBeGroups([DEDUCTION_MODE_DELIVERY]);
  }
}

/** Case-insensitive match on SKU or name; an empty query keeps everything. */
export function searchOverviewProducts(
  products: readonly KardexOverviewProduct[],
  query: string,
): KardexOverviewProduct[] {
  const q = query.trim().toLowerCase();
  if (!q) return [...products];
  return products.filter((p) => p.sku.toLowerCase().includes(q) || p.name.toLowerCase().includes(q));
}

export function sortOverviewProducts(
  products: readonly KardexOverviewProduct[],
  key: OverviewSortKey,
  dir: "asc" | "desc",
): KardexOverviewProduct[] {
  const sorted = [...products].sort((a, b) => {
    if (key === "sku" || key === "name") return a[key].localeCompare(b[key]);
    return a[key] - b[key];
  });
  return dir === "desc" ? sorted.reverse() : sorted;
}

type T = {
  (key: string, values?: Record<string, string | number>): string;
  has: (key: string) => boolean;
};

/** The group header text: a known deduction mode gets its catalogue label, an unknown one shows as-is. */
export function overviewGroupLabel(deductionMode: string | null, t: T): string {
  if (!deductionMode) return t("overview.groupTotal");
  return t.has(`overview.group.${deductionMode}`) ? t(`overview.group.${deductionMode}`) : deductionMode;
}

/**
 * The exact groups the screen renders for a given view, search and sort — a product's row never
 * disappears from one group and reappears, differently sorted, in the CSV.
 */
export function visibleOverviewGroups(
  data: KardexOverview,
  opts: { view: OverviewView; query: string; sortKey: OverviewSortKey; sortDir: "asc" | "desc" },
): OverviewTableGroup[] {
  return overviewGroupsForView(data, opts.view).map((g) => ({
    ...g,
    products: sortOverviewProducts(searchOverviewProducts(g.products, opts.query), opts.sortKey, opts.sortDir),
  }));
}
