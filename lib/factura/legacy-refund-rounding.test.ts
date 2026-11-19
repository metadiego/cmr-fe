import { test } from "node:test";
import assert from "node:assert/strict";

import { LEGACY_ROUNDING_TOLERANCE, legacyRefundCheck, toleranceFrom } from "./legacy-refund-rounding.ts";

const base = { cap: 1616.79, legacy: true, everyLineHasAmount: true, largestLine: 1000, tolerance: 0.05 };

test("S040286: a cent over on a legacy invoice does not block, shows the cap and the adjustment", () => {
  assert.deepEqual(legacyRefundCheck({ ...base, net: 1616.8 }), { exceeds: false, adjustment: 0.01, net: 1616.79 });
});

test("float noise is compared in cents", () => {
  assert.deepEqual(legacyRefundCheck({ ...base, net: 1616.7900000000002 }), { exceeds: false, adjustment: 0, net: 1616.7900000000002 });
  assert.equal(legacyRefundCheck({ ...base, net: 1616.84 }).adjustment, 0.05);
});

test("beyond the tolerance, a non-legacy invoice, or lines without amount keep blocking", () => {
  assert.equal(legacyRefundCheck({ ...base, net: 1616.85 }).exceeds, true);
  assert.equal(legacyRefundCheck({ ...base, net: 1616.8, legacy: false }).exceeds, true);
  assert.equal(legacyRefundCheck({ ...base, net: 1616.8, everyLineHasAmount: false }).exceeds, true);
  assert.equal(legacyRefundCheck({ ...base, net: 1616.8, tolerance: 0 }).exceeds, true);
  assert.equal(legacyRefundCheck({ ...base, net: 0.03, cap: 0, largestLine: 0.02 }).exceeds, true);
});

test("under the cap nothing changes", () => {
  assert.deepEqual(legacyRefundCheck({ ...base, net: 100 }), { exceeds: false, adjustment: 0, net: 100 });
});

test("toleranceFrom reads the policy config, [0,1], else the default", () => {
  assert.equal(toleranceFrom({ legacyRoundingTolerance: 0.02 }), 0.02);
  assert.equal(toleranceFrom({ legacyRoundingTolerance: 0 }), 0);
  assert.equal(toleranceFrom({ legacyRoundingTolerance: 5 }), LEGACY_ROUNDING_TOLERANCE);
  assert.equal(toleranceFrom({ legacyRoundingTolerance: null }), LEGACY_ROUNDING_TOLERANCE);
  assert.equal(toleranceFrom(undefined), LEGACY_ROUNDING_TOLERANCE);
});
