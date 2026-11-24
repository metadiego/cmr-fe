import { test } from "node:test";
import assert from "node:assert/strict";

import { deliveryCsv } from "./delivery-control-csv.ts";
import type { KardexDeliveryControl } from "../api/inventory-kardex.ts";

const t = (k: string, v?: Record<string, string | number>) => (v ? `${k}(${Object.values(v).join(",")})` : k);
const monthLabel = (m: string | null) => m ?? "legacy";

const data: KardexDeliveryControl = {
  product: { id: "prod", sku: "nanoaerplu", name: "NANO AER PLUS", deductionMode: "a_la_entrega" },
  from: "2026-11-01",
  to: "2026-11-24",
  lines: [
    {
      patientId: "pat1",
      recordNumber: "1113",
      patientName: "VILMA IVELISSE VAZQUEZ RODRIGUEZ",
      invoiceDate: null,
      invoiceNumber: null,
      month: null,
      sold: 2,
      delivered: 2,
      deliveryDates: ["2026-11-06"],
      refunded: 0,
      refundNumbers: [],
      pending: 0,
      notes: null,
      legacy: true,
      soldAs: { productId: "prod", sku: null, name: "", channel: "direct" },
      packageIds: ["pkg1"],
    },
  ],
  months: [{ month: null, sold: 2, delivered: 2, pending: 0 }],
  protocols: { total: 0, byProtocol: [], detail: [] },
  warehouse: { deductionMode: "a_la_entrega", soldInPeriod: 2, protocols: 0, systemStock: 4, pending: 0, freeStock: 4, physical: 4 },
  warnings: [],
};

test("deliveryCsv: header, one row per line, a BE subtotal per month, then the total pending", () => {
  const rows = deliveryCsv(data, t, monthLabel);
  assert.deepEqual(rows[0], [
    "delivery.col.record",
    "delivery.col.patient",
    "delivery.col.date",
    "delivery.col.invoice",
    "delivery.col.sold",
    "delivery.col.delivered",
    "delivery.col.deliveryDates",
    "delivery.col.pending",
    "delivery.col.notes",
  ]);
  assert.deepEqual(rows[1], ["1113", "VILMA IVELISSE VAZQUEZ RODRIGUEZ", "", "", 2, 2, "2026-11-06", 0, ""]);
  assert.deepEqual(rows[2], ["legacy", "", "", "", 2, 2, "", 0, ""]);
  assert.deepEqual(rows.at(-1), ["delivery.totalPending", "", "", "", "", "", "", 0, ""]);
});

test("deliveryCsv: no data gives no rows", () => {
  assert.deepEqual(deliveryCsv(null, t, monthLabel), []);
});
