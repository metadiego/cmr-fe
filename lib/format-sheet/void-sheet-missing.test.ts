import { test } from "node:test";
import assert from "node:assert/strict";

import { VOID_REASON, voidReasonFilled, voidReasonProblem } from "./void-sheet-missing.ts";

test("an empty or blank reason is missing, never a problem", () => {
  assert.equal(voidReasonFilled(""), false);
  assert.equal(voidReasonFilled("   "), false);
  assert.equal(voidReasonProblem("   "), null);
});

test("a reason is measured trimmed, between 3 and 500 characters", () => {
  assert.equal(voidReasonProblem(" ab "), "tooShort");
  assert.equal(voidReasonProblem("abc"), null);
  assert.equal(voidReasonProblem("x".repeat(VOID_REASON.max)), null);
  assert.equal(voidReasonProblem("x".repeat(VOID_REASON.max + 1)), "tooLong");
  assert.equal(voidReasonFilled(" abc "), true);
});
