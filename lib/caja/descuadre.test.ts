import { test } from "node:test";
import assert from "node:assert/strict";

import { cashierUnbalanced, descuadreOf, overrideDiffers } from "./descuadre.ts";

test("short, over, balanced and missing", () => {
  assert.deepEqual(descuadreOf(-50), { kind: "short", amount: 50 });
  assert.deepEqual(descuadreOf(12.5), { kind: "over", amount: 12.5 });
  assert.equal(descuadreOf(0), null);
  assert.equal(descuadreOf(0.004), null);
  assert.equal(descuadreOf(null), null);
  assert.equal(descuadreOf(undefined), null);
  assert.equal(descuadreOf(Number.NaN), null);
});

test("a cashier is boxed by the BE flag, or by its difference when the flag is missing", () => {
  assert.equal(cashierUnbalanced({ balanced: false, difference: 0 }), true);
  assert.equal(cashierUnbalanced({ balanced: true, difference: -5 }), false);
  assert.equal(cashierUnbalanced({ difference: -5 }), true);
  assert.equal(cashierUnbalanced({}), false);
});

test("override only counts when its difference is not zero", () => {
  assert.equal(overrideDiffers(null), false);
  assert.equal(overrideDiffers({ difference: 0 }), false);
  assert.equal(overrideDiffers({ difference: -50 }), true);
});
