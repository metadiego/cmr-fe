import { test } from "node:test";
import assert from "node:assert/strict";

import { canRefundInvoice, canVoidInvoice, invoiceBadgeStatus, isIssuedInvoice, isUntouchedIssued, refundableOf, refundStateOf } from "./refund-status.ts";

test("refundStateOf: the derived field wins; legacy statuses are the fallback", () => {
  // S243352 (Bayamón, 20-nov): legacy status, derived partial
  assert.equal(refundStateOf({ status: "devuelta_parcial", refundStatus: "partial" }), "partial");
  // 001229 (Caguas): legacy partial, but 7000 of 7000 returned
  assert.equal(refundStateOf({ status: "devuelta_parcial", refundStatus: "full" }), "full");
  // a new refund leaves the invoice emitida
  assert.equal(refundStateOf({ status: "emitida", refundStatus: "partial" }), "partial");
  assert.equal(refundStateOf({ status: "devuelta_total" }), "full");
  assert.equal(refundStateOf({ status: "emitida" }), "none");
});

test("invoiceBadgeStatus: refunded from the derived state, legacy with nothing left reads emitida", () => {
  assert.equal(invoiceBadgeStatus({ status: "emitida", refundStatus: "partial" }), "devuelta_parcial");
  assert.equal(invoiceBadgeStatus({ status: "devuelta_parcial", refundStatus: "full" }), "devuelta_total");
  assert.equal(invoiceBadgeStatus({ status: "devuelta_total", refundStatus: "none" }), "emitida");
  assert.equal(invoiceBadgeStatus({ status: "borrador" }), "borrador");
  assert.equal(invoiceBadgeStatus({ status: "anulada", refundStatus: "none" }), "anulada");
});

test("canRefundInvoice / canVoidInvoice: issued and not fully refunded", () => {
  assert.equal(canRefundInvoice({ status: "emitida", refundStatus: "partial" }), true);
  assert.equal(canRefundInvoice({ status: "devuelta_total", refundStatus: "partial" }), true);
  assert.equal(canRefundInvoice({ status: "devuelta_parcial", refundStatus: "full" }), false);
  assert.equal(canRefundInvoice({ status: "borrador" }), false);
  assert.equal(canVoidInvoice({ status: "emitida", refundStatus: "full" }), false);
  assert.equal(canVoidInvoice({ status: "emitida", refundStatus: "none" }), true);
  assert.equal(isIssuedInvoice("anulada"), false);
});

test("isUntouchedIssued: reopen and friends only with nothing refunded", () => {
  assert.equal(isUntouchedIssued({ status: "emitida", refundStatus: "none" }), true);
  assert.equal(isUntouchedIssued({ status: "emitida", refundStatus: "partial" }), false);
  assert.equal(isUntouchedIssued({ status: "devuelta_total", refundStatus: "none" }), true);
});

test("refundableOf: the BE's refundable*, else total − refunded, never negative", () => {
  // S243352's line: 12 units, 7 returned → 5 refundable; sessions 0
  const line = { quantity: 12, sessions: 12, refundedQuantity: 7, refundedSessions: 0, refundableQuantity: 5, refundableSessions: 0 };
  assert.equal(refundableOf(line, "quantity"), 5);
  // refundableSessions already nets delivered sessions: 0, not 12 − 0
  assert.equal(refundableOf(line, "sessions"), 0);
  assert.equal(refundableOf({ quantity: 3, refundedQuantity: 1 }, "quantity"), 2);
  assert.equal(refundableOf({ quantity: 1, refundedQuantity: 4 }, "quantity"), 0);
});
