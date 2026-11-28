import { test } from "node:test";
import assert from "node:assert/strict";

import { purchasesRefundsCsv } from "./purchases-refunds-csv.ts";
import type { KardexPurchasesRefunds } from "../api/inventory-kardex.ts";

const t = (key: string, values?: Record<string, string | number>) =>
  values ? `${key}(${JSON.stringify(values)})` : key;

const data: KardexPurchasesRefunds = {
  product: { id: "p1", sku: "SKU1", name: "Nano Aer Plus", capacity: null },
  from: "2026-10-01",
  to: "2026-10-31",
  purchases: [
    {
      date: "2026-10-05",
      recordNumber: "103080",
      patientName: "RAFAEL MORCIGLIO",
      invoiceNumber: "I-1",
      channel: "direct",
      soldAs: null,
      quantity: 2,
    },
  ],
  refunds: [
    {
      date: "2026-10-10",
      refundNumber: "R-1",
      invoiceNumber: "I-1",
      recordNumber: "103080",
      patientName: "RAFAEL MORCIGLIO",
      quantity: 1,
      viaKit: false,
    },
  ],
  totals: { purchased: 2, refunded: 1, net: 1 },
  undatedLegacy: { packages: 0, quantity: 0 },
};

test("null data returns no rows", () => {
  assert.deepEqual(purchasesRefundsCsv(null, t), []);
});

test("includes both section headers and their own column headers", () => {
  const rows = purchasesRefundsCsv(data, t);
  assert.ok(rows.some((r) => r[0] === "purchasesRefunds.sectionPurchases"));
  assert.ok(rows.some((r) => r[0] === "purchasesRefunds.sectionRefunds"));
});

test("a purchase row carries its channel text and quantity", () => {
  const rows = purchasesRefundsCsv(data, t);
  const row = rows.find((r) => r[1] === "103080" && r[3] === "I-1");
  assert.ok(row);
  assert.equal(row![4], "purchasesRefunds.channel.direct");
  assert.equal(row![5], 2);
});

test("totals (purchased/refunded/net) all appear", () => {
  const rows = purchasesRefundsCsv(data, t);
  assert.ok(rows.some((r) => r[0] === "purchasesRefunds.totalPurchased" && r[5] === 2));
  assert.ok(rows.some((r) => r[0] === "purchasesRefunds.totalRefunded" && r[5] === 1));
  assert.ok(rows.some((r) => r[0] === "purchasesRefunds.totalNet" && r[5] === 1));
});

test("a refund marked viaKit says so in its quantity cell", () => {
  const withKit: KardexPurchasesRefunds = {
    ...data,
    refunds: [{ ...data.refunds[0], viaKit: true }],
  };
  const rows = purchasesRefundsCsv(withKit, t);
  const row = rows.find((r) => r[1] === "R-1");
  assert.equal(row![5], "1 (purchasesRefunds.viaKit)");
});

test("undatedLegacy row appears only when there is something undated", () => {
  assert.equal(purchasesRefundsCsv(data, t).some((r) => String(r[0]).includes("undatedLegacy")), false);
  const withUndated: KardexPurchasesRefunds = { ...data, undatedLegacy: { packages: 2, quantity: 8 } };
  assert.ok(purchasesRefundsCsv(withUndated, t).some((r) => String(r[0]).includes("undatedLegacy")));
});
