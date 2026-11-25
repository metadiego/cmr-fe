import { test } from "node:test";
import assert from "node:assert/strict";

import { deliveryObservationsText, groupDeliveryLines } from "./delivery-control.ts";
import type { KardexDeliveryLine } from "@/lib/api/inventory-kardex";

const t = (k: string, v?: Record<string, string | number>) => (v ? `${k}(${Object.values(v).join(",")})` : k);

const line = (over: Partial<KardexDeliveryLine>): KardexDeliveryLine => ({
  patientId: "p1",
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
  packageIds: [],
  ...over,
});

test("groupDeliveryLines: one group per BE month, in the BE's own order, each with the BE's own subtotal", () => {
  const lines = [
    line({ recordNumber: "a", month: "2026-10" }),
    line({ recordNumber: "b", month: null }),
    line({ recordNumber: "c", month: "2026-10" }),
  ];
  const months = [
    { month: null, sold: 25, delivered: 0, pending: 25 },
    { month: "2026-10", sold: 4, delivered: 0, pending: 4 },
  ];
  const groups = groupDeliveryLines(lines, months);
  assert.deepEqual(
    groups.map((g) => [g.month, g.lines.map((l) => l.recordNumber), g.sold, g.delivered, g.pending]),
    [
      [null, ["b"], 25, 0, 25],
      ["2026-10", ["a", "c"], 4, 0, 4],
    ],
  );
});

test("groupDeliveryLines: a month with no matching line still carries its BE subtotal", () => {
  const groups = groupDeliveryLines([], [{ month: "2026-09", sold: 2, delivered: 0, pending: 2 }]);
  assert.deepEqual(groups, [{ month: "2026-09", lines: [], sold: 2, delivered: 0, pending: 2 }]);
});

test("deliveryObservationsText: a plain direct sale with no note or refund says nothing", () => {
  assert.equal(deliveryObservationsText(line({}), t), "");
});

test("deliveryObservationsText: note, refunds and a non-direct channel all join", () => {
  const text = deliveryObservationsText(
    line({
      notes: "Se adelantó por pedido del paciente",
      refundNumbers: ["R-10", "R-11"],
      soldAs: { productId: "kit1", sku: "K1", name: "#1 ULTRA PLUS ARTICULACIONES", channel: "kit" },
    }),
    t,
  );
  assert.equal(
    text,
    "Se adelantó por pedido del paciente · delivery.refundNote(R-10) · delivery.refundNote(R-11) · #1 ULTRA PLUS ARTICULACIONES",
  );
});

test("deliveryObservationsText: a direct sale never shows soldAs, even when it has a name", () => {
  const text = deliveryObservationsText(
    line({ soldAs: { productId: "p", sku: "sku", name: "NANO AER PLUS", channel: "direct" } }),
    t,
  );
  assert.equal(text, "");
});
