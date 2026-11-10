import { test } from "node:test";
import assert from "node:assert/strict";

import { hiltPages } from "./hilt-sheet.ts";

const region = (name: string, n: number) => ({ region: name, filas: Array.from({ length: n }, (_, i) => i) });

test("hiltPages: the legacy split — Rachis, Shoulder, Knee and Oedema first; the rest second", () => {
  const prod = [
    region("Rachis", 7), region("Shoulder", 7), region("Knee", 7), region("Elbow", 8), region("Hip", 6),
    region("Wrist and Hand", 8), region("Pelvic Girdle", 7), region("Ankle", 5), region("Foot", 5), region("Oedema", 1),
  ];
  const { first, second } = hiltPages(prod);
  assert.deepEqual(first.map((r) => r.region), ["Rachis", "Shoulder", "Knee", "Oedema"]);
  assert.deepEqual(second.map((r) => r.region), ["Elbow", "Hip", "Wrist and Hand", "Pelvic Girdle", "Ankle", "Foot"]);
});

test("hiltPages: everything fits → one sheet; a region bigger than the sheet still prints, second", () => {
  assert.equal(hiltPages([region("A", 3), region("B", 4)]).second.length, 0);
  const r = hiltPages([region("Huge", 30), region("Small", 2)]);
  assert.deepEqual(r.first.map((x) => x.region), ["Small"]);
  assert.deepEqual(r.second.map((x) => x.region), ["Huge"]);
});

test("hiltPages: no regions → two empty sheets", () => {
  assert.deepEqual(hiltPages([]), { first: [], second: [] });
});
