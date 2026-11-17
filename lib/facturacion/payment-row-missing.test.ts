import { test } from "node:test";
import assert from "node:assert/strict";

import { paymentAmountIssue, paymentRowMissing } from "./payment-row-missing.ts";

test("paymentRowMissing: no method → listed", () => {
  assert.deepEqual(paymentRowMissing({ methodId: "", amount: "25.00" }), ["method"]);
});
test("paymentRowMissing: blank amount → listed", () => {
  assert.deepEqual(paymentRowMissing({ methodId: "m1", amount: "" }), ["amount"]);
  assert.deepEqual(paymentRowMissing({ methodId: "m1", amount: "   " }), ["amount"]);
});
test("paymentRowMissing: both missing → in on-screen order", () => {
  assert.deepEqual(paymentRowMissing({ methodId: "", amount: "" }), ["method", "amount"]);
});
test("paymentRowMissing: a filled amount of 0 is not missing (it is invalid)", () => {
  assert.deepEqual(paymentRowMissing({ methodId: "m1", amount: "0" }), []);
});
test("paymentRowMissing: all present → []", () => {
  assert.deepEqual(paymentRowMissing({ methodId: "m1", amount: "25.00" }), []);
});

test("paymentAmountIssue: blank → null (that is missing, not invalid)", () => {
  assert.equal(paymentAmountIssue("", 100), null);
  assert.equal(paymentAmountIssue("  ", 100), null);
});
test("paymentAmountIssue: zero, negative or not a number → notPositive", () => {
  assert.equal(paymentAmountIssue("0", 100), "notPositive");
  assert.equal(paymentAmountIssue("0.00", 100), "notPositive");
  assert.equal(paymentAmountIssue("-5", 100), "notPositive");
  assert.equal(paymentAmountIssue("abc", 100), "notPositive");
  assert.equal(paymentAmountIssue("1,50", 100), "notPositive");
});
test("paymentAmountIssue: over the cap → exceedsCap; within the cents slack → fine", () => {
  assert.equal(paymentAmountIssue("100.01", 100), "exceedsCap");
  assert.equal(paymentAmountIssue("100.004", 100), null);
  assert.equal(paymentAmountIssue("100", 100), null);
});
test("paymentAmountIssue: no cap (refunds) → never exceedsCap", () => {
  assert.equal(paymentAmountIssue("99999", null), null);
});
test("paymentAmountIssue: a cap of 0 (settled invoice) refuses any positive amount", () => {
  assert.equal(paymentAmountIssue("0.01", 0), "exceedsCap");
});
test("paymentAmountIssue: matches the rows' old rule (n > 0 && !exceeds) on sample inputs", () => {
  const cap = 80;
  for (const a of ["", " ", "0", "1", "80", "80.005", "80.006", "81", "-1", "x", " 5 "]) {
    const n = Number(a);
    const oldValid = n > 0 && !(n > cap + 0.005);
    const newValid = a.trim() !== "" && paymentAmountIssue(a, cap) === null;
    assert.equal(newValid, oldValid, `amount ${JSON.stringify(a)}`);
  }
});
