import { test } from "node:test";
import assert from "node:assert/strict";

import { areasCount, cell, legacyDay, sameHeight } from "./mls-sheet.ts";

test("legacyDay: MM-DD-YYYY like the legacy; anything else blank", () => {
  assert.equal(legacyDay("2026-10-09"), "10-09-2026");
  assert.equal(legacyDay("2026-11-10T14:00:00Z"), "11-10-2026");
  assert.equal(legacyDay(""), "");
  assert.equal(legacyDay(null), "");
  assert.equal(legacyDay("2026-10-09", "/"), "10/09/2026", "the procedure sheets (APEX, Empower) use slashes");
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

test("areasCount: once per área, 2 or more", () => {
  assert.equal(areasCount(2), 2);
  assert.equal(areasCount(4), 4);
});

test("areasCount: 1, 0, negative or no data all fall back to a single repeat", () => {
  assert.equal(areasCount(1), 1);
  assert.equal(areasCount(0), 1);
  assert.equal(areasCount(-3), 1);
  assert.equal(areasCount(null), 1);
  assert.equal(areasCount(undefined), 1);
});

test("areasCount: a decimal áreas value is truncated, not rounded", () => {
  assert.equal(areasCount(3.9), 3);
});
