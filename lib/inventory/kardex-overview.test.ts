import { test } from "node:test";
import assert from "node:assert/strict";

import {
  overviewGroupLabel,
  overviewGroupsForView,
  searchOverviewProducts,
  sortOverviewProducts,
  visibleOverviewGroups,
} from "./kardex-overview.ts";
import type { KardexOverview, KardexOverviewProduct } from "../api/inventory-kardex.ts";

const t = Object.assign((k: string, v?: Record<string, string | number>) => (v ? `${k}(${Object.values(v).join(",")})` : k), {
  has: (k: string) => k === "overview.group.a_la_venta" || k === "overview.group.a_la_entrega",
});

const totals = (n: number) => ({
  opening: n,
  inbound: n,
  applied: n,
  manualOutputs: n,
  adjustments: n,
  closing: n,
  pending: n,
  physical: n,
  freeStock: n,
});

const product = (over: Partial<KardexOverviewProduct>): KardexOverviewProduct => ({
  productId: "p1",
  sku: "AAA",
  name: "Alpha",
  deductionMode: "a_la_venta",
  ...totals(0),
  ...over,
});

const data: KardexOverview = {
  from: "2026-11-01",
  to: "2026-11-24",
  products: [
    product({ productId: "p1", sku: "NANO", name: "Nano Aer Plus", deductionMode: "a_la_entrega", ...totals(5) }),
    product({ productId: "p2", sku: "BTOX", name: "Botox", deductionMode: "a_la_venta", ...totals(10) }),
  ],
  groups: [
    { deductionMode: "a_la_entrega", totals: totals(5), productIds: ["p1"] },
    { deductionMode: "a_la_venta", totals: totals(10), productIds: ["p2"] },
  ],
  totals: totals(15),
};

test("overviewGroupsForView: together is one table with the BE's overall totals", () => {
  const groups = overviewGroupsForView(data, "together");
  assert.equal(groups.length, 1);
  assert.equal(groups[0].deductionMode, null);
  assert.deepEqual(groups[0].totals, totals(15));
  assert.equal(groups[0].products.length, 2);
});

test("overviewGroupsForView: separated keeps the BE's own groups and order", () => {
  const groups = overviewGroupsForView(data, "separated");
  assert.deepEqual(
    groups.map((g) => [g.deductionMode, g.products.map((p) => p.sku)]),
    [
      ["a_la_entrega", ["NANO"]],
      ["a_la_venta", ["BTOX"]],
    ],
  );
});

test("overviewGroupsForView: saleOnly/deliveryOnly keep just that one BE group", () => {
  assert.deepEqual(overviewGroupsForView(data, "saleOnly")[0].products.map((p) => p.sku), ["BTOX"]);
  assert.deepEqual(overviewGroupsForView(data, "deliveryOnly")[0].products.map((p) => p.sku), ["NANO"]);
});

test("searchOverviewProducts: matches SKU or name, case-insensitively; empty query keeps all", () => {
  assert.equal(searchOverviewProducts(data.products, "nano").length, 1);
  assert.equal(searchOverviewProducts(data.products, "botox").length, 1);
  assert.equal(searchOverviewProducts(data.products, "").length, 2);
  assert.equal(searchOverviewProducts(data.products, "zzz").length, 0);
});

test("sortOverviewProducts: numeric and text columns, both directions", () => {
  const bySku = sortOverviewProducts(data.products, "sku", "asc");
  assert.deepEqual(bySku.map((p) => p.sku), ["BTOX", "NANO"]);
  const byClosingDesc = sortOverviewProducts(data.products, "closing", "desc");
  assert.deepEqual(byClosingDesc.map((p) => p.sku), ["BTOX", "NANO"]);
});

test("overviewGroupLabel: a known mode gets its catalogue label, an unknown one shows as-is", () => {
  assert.equal(overviewGroupLabel("a_la_venta", t), "overview.group.a_la_venta");
  assert.equal(overviewGroupLabel(null, t), "overview.groupTotal");
  assert.equal(overviewGroupLabel("modo_futuro", t), "modo_futuro");
});

test("visibleOverviewGroups: search and sort apply inside each group", () => {
  const groups = visibleOverviewGroups(data, { view: "together", query: "nano", sortKey: "sku", sortDir: "asc" });
  assert.equal(groups.length, 1);
  assert.deepEqual(groups[0].products.map((p) => p.sku), ["NANO"]);
  assert.deepEqual(groups[0].totals, totals(15), "search narrows the rows, never the BE's own group total");
});
