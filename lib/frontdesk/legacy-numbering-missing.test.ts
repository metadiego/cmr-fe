import { test } from "node:test";
import assert from "node:assert/strict";

import { changedCount, legacyLabelCheck, renumberCheck } from "./legacy-numbering-missing.ts";

test("legacyLabelCheck: 1 ≤ n ≤ m, whole numbers, reason of 3+", () => {
  const ok = legacyLabelCheck({ number: "1", total: "12", reason: "legado" });
  assert.deepEqual([ok.invalid, ok.number, ok.total, ok.filled.reason], [false, 1, 12, true]);
  assert.equal(legacyLabelCheck({ number: "13", total: "12", reason: "x" }).invalid, true);
  assert.equal(legacyLabelCheck({ number: "0", total: "12", reason: "x" }).invalid, true);
  assert.equal(legacyLabelCheck({ number: "1.5", total: "12", reason: "x" }).invalid, true);
  const empty = legacyLabelCheck({ number: "", total: "12", reason: "ab" });
  assert.deepEqual([empty.invalid, empty.filled.number, empty.filled.reason], [false, false, false]);
});

test("renumberCheck: start defaults to 1 and must fit in the total; from ≤ to", () => {
  const ok = renumberCheck({ total: "12", startAt: "", from: "", to: "", reason: "serie" });
  assert.deepEqual([ok.invalid, ok.total, ok.startAt], [false, 12, 1]);
  assert.equal(renumberCheck({ total: "12", startAt: "13", from: "", to: "", reason: "x" }).invalid, true);
  const range = renumberCheck({ total: "12", startAt: "1", from: "2026-11-02", to: "2026-11-01", reason: "x" });
  assert.deepEqual([range.invalid, range.badRange], [true, true]);
  assert.equal(renumberCheck({ total: "", startAt: "", from: "", to: "", reason: "" }).invalid, false);
});

test("changedCount", () => {
  assert.equal(changedCount([{ changed: true }, { changed: false }, { changed: true }]), 2);
});
