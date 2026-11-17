import { test } from "node:test";
import assert from "node:assert/strict";

import { adjustmentCheck, type AdjustmentState } from "./adjustment-missing.ts";

const movement: AdjustmentState = {
  mode: "movimiento",
  byVials: false,
  hasWarehouse: true,
  quantity: "2",
  reason: "rotura",
  counted: "",
  stock: 55,
  vialsCounted: false,
  notes: "A vial broke",
};
const count: AdjustmentState = { ...movement, mode: "conteo", quantity: "", reason: "", counted: "54" };
const vials: AdjustmentState = { ...count, counted: "", byVials: true, vialsCounted: true };

test("movement, all present → nothing missing, no problem", () => {
  assert.deepEqual(adjustmentCheck(movement), { missing: [], problem: null });
});

test("movement, empty quantity → quantity missing", () => {
  assert.deepEqual(adjustmentCheck({ ...movement, quantity: "  " }).missing, ["quantity"]);
});

test("movement, no reason → reason missing", () => {
  assert.deepEqual(adjustmentCheck({ ...movement, reason: "" }).missing, ["reason"]);
});

test("movement, blank notes → notes missing", () => {
  assert.deepEqual(adjustmentCheck({ ...movement, notes: "  " }).missing, ["notes"]);
});

test("movement, empty form → in on-screen order", () => {
  assert.deepEqual(
    adjustmentCheck({ ...movement, quantity: "", reason: "", notes: "" }).missing,
    ["quantity", "reason", "notes"],
  );
});

test("movement, quantity zero is filled but invalid (not missing)", () => {
  assert.deepEqual(adjustmentCheck({ ...movement, quantity: "0" }), {
    missing: [],
    problem: "quantityInvalid",
  });
});

test("movement, negative quantity is invalid", () => {
  assert.equal(adjustmentCheck({ ...movement, quantity: "-3" }).problem, "quantityInvalid");
});

test("movement, decimal quantity is fine", () => {
  assert.equal(adjustmentCheck({ ...movement, quantity: "0.25" }).problem, null);
});

test("count, all present → nothing missing, no problem", () => {
  assert.deepEqual(adjustmentCheck(count), { missing: [], problem: null });
});

test("count does not ask for quantity or reason", () => {
  assert.deepEqual(adjustmentCheck({ ...count, notes: "" }).missing, ["notes"]);
});

test("count, empty counted → counted missing", () => {
  assert.deepEqual(adjustmentCheck({ ...count, counted: "" }).missing, ["counted"]);
});

test("count equal to the system → no difference (filled, not missing)", () => {
  assert.deepEqual(adjustmentCheck({ ...count, counted: "55" }), {
    missing: [],
    problem: "noDifference",
  });
});

test("count of zero with stock is a real difference", () => {
  assert.equal(adjustmentCheck({ ...count, counted: "0" }).problem, null);
});

test("by vials, all present → nothing missing", () => {
  assert.deepEqual(adjustmentCheck(vials), { missing: [], problem: null });
});

test("by vials, nothing counted → vialCount missing (counted field ignored)", () => {
  assert.deepEqual(adjustmentCheck({ ...vials, vialsCounted: false }).missing, ["vialCount"]);
});

test("by vials, blank notes → notes missing", () => {
  assert.deepEqual(adjustmentCheck({ ...vials, notes: "" }).missing, ["notes"]);
});

test("no warehouse → blocked with its reason, no fields listed", () => {
  assert.deepEqual(adjustmentCheck({ ...movement, hasWarehouse: false, notes: "" }), {
    missing: [],
    problem: "noWarehouse",
  });
});
