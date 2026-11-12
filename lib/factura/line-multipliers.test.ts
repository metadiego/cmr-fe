import { test } from "node:test";
import assert from "node:assert/strict";

import { multiplierPatch } from "./line-multipliers.ts";

const line = { dias: 12, areas: 4 };

test("sends only the multiplier that changed (the PUT merges meta)", () => {
  assert.deepEqual(multiplierPatch(line, { dias: "12", areas: "1" }), { kind: "patch", meta: { areas: 1 } });
});

test("nothing changed → no request", () => {
  assert.deepEqual(multiplierPatch(line, { dias: " 12 ", areas: "4" }), { kind: "none" });
});

test("empty, zero, negative or fractional → invalid, naming the field", () => {
  for (const bad of ["", "0", "-2", "1.5", "abc"]) {
    assert.deepEqual(multiplierPatch(line, { dias: "12", areas: bad }), { kind: "invalid", field: "areas" });
  }
});

test("keys the line does not carry are ignored, never invented", () => {
  assert.deepEqual(multiplierPatch(line, { zona: "3", areas: "2" }), { kind: "patch", meta: { areas: 2 } });
});
