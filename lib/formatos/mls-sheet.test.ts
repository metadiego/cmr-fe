import { test } from "node:test";
import assert from "node:assert/strict";

import { cell, legacyDay, sameHeight } from "./mls-sheet.ts";

test("legacyDay: MM-DD-YYYY like the legacy; anything else blank", () => {
  assert.equal(legacyDay("2026-10-09"), "10-09-2026");
  assert.equal(legacyDay("2026-11-10T14:00:00Z"), "11-10-2026");
  assert.equal(legacyDay(""), "");
  assert.equal(legacyDay(null), "");
});

test("cell: blank instead of a dash when the parameter has no value", () => {
  assert.equal(cell(null), "");
  assert.equal(cell(undefined), "");
  assert.equal(cell(" 900CPW "), "900CPW");
  assert.equal(cell(10), "10");
});

test("sameHeight: the shorter side is padded with blank rows", () => {
  const r = sameHeight([1, 2, 3], [4]);
  assert.deepEqual(r.left, [1, 2, 3]);
  assert.deepEqual(r.right, [4, null, null]);
  assert.deepEqual(sameHeight([], []), { left: [], right: [] });
});
