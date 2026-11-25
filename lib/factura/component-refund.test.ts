import { test } from "node:test";
import assert from "node:assert/strict";

import { compDefaultRefund, compKeyOf } from "./component-refund.ts";

test("compKeyOf: a component with its own id is keyed by it", () => {
  assert.equal(compKeyOf({ invoiceItemComponentId: "comp-1", productId: "prod-1" }), "comp-1");
});

test("compKeyOf: no invoiceItemComponentId (legacy kit, cmr-be #705): keyed by productId instead", () => {
  assert.equal(compKeyOf({ invoiceItemComponentId: null, productId: "prod-1" }), "prod-1");
});

test("compKeyOf: neither id present: empty string, never a crash", () => {
  assert.equal(compKeyOf({}), "");
});

test("compDefaultRefund: prefers paidShare, prorated by the quantity returned", () => {
  // S039390 verification case: NPT component, quantity 1, paidShare 8413.46.
  assert.equal(compDefaultRefund({ quantity: 1, price: 10000, paidShare: 8413.46 }, 1), 8413.46);
});

test("compDefaultRefund: a partial quantity prorates paidShare, not the list price", () => {
  // Vitamina C component: quantity 12, paidShare 1413.46 for the whole line → half back for 6.
  const half = compDefaultRefund({ quantity: 12, price: 140, paidShare: 1413.46 }, 6);
  assert.ok(Math.abs(half - 706.73) < 0.01);
});

test("compDefaultRefund: no paidShare (BE response ahead of this field): falls back to the billed price", () => {
  assert.equal(compDefaultRefund({ quantity: 2, price: 100 }, 1), 50);
});

test("compDefaultRefund: zero or missing quantity: 0, never divides by zero", () => {
  assert.equal(compDefaultRefund({ quantity: 0, price: 100, paidShare: 50 }, 1), 0);
  assert.equal(compDefaultRefund({}, 1), 0);
});
