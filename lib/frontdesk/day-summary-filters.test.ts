import { test } from "node:test";
import assert from "node:assert/strict";

import { distinctValues, filterKind, filterRows, sumRows } from "./day-summary-filters.ts";

type R = { patient: string; nurse: string; sealedVials: number };
const rows: R[] = [
  { patient: "José Peña", nurse: "Glorimar", sealedVials: 1 },
  { patient: "Ana Ruiz", nurse: "Britalie", sealedVials: 2 },
  { patient: "Teresa Rosado", nurse: "Glorimar", sealedVials: 0 },
];
const text = (r: R, c: string) => String((r as Record<string, unknown>)[c] ?? "");

test("text columns match contains, ignoring accents and case; pick columns match exactly", () => {
  assert.equal(filterKind("patient"), "text");
  assert.equal(filterKind("nurse"), "pick");
  assert.deepEqual(filterRows(rows, { patient: "pena" }, text).map((r) => r.patient), ["José Peña"]);
  assert.deepEqual(filterRows(rows, { nurse: "Glorimar" }, text).length, 2);
  assert.deepEqual(filterRows(rows, { nurse: "Glori" }, text).length, 0);
  assert.deepEqual(filterRows(rows, { nurse: "Glorimar", sealedVials: "0" }, text).map((r) => r.patient), ["Teresa Rosado"]);
  assert.equal(filterRows(rows, { patient: "  " }, text).length, 3);
});

test("distinctValues sorts numbers numerically and text alphabetically", () => {
  assert.deepEqual(distinctValues([{ v: "10" }, { v: "2" }, { v: "2" }], "v", (r, c) => (r as Record<string, string>)[c]), ["2", "10"]);
  assert.deepEqual(distinctValues(rows, "nurse", text), ["Britalie", "Glorimar"]);
});

test("sumRows totals what is on screen", () => {
  const s = sumRows([
    { quantity: 1, sealedVials: 1, content: 25, patient: "A", medicalRecordNumber: "1" },
    { quantity: 1, sealedVials: 0, content: 10, patient: "A", medicalRecordNumber: "1" },
    { quantity: 2, sealedVials: 2, content: 40, patient: "B", record: "2" },
  ]);
  assert.deepEqual(s, { sessions: 3, patients: 2, quantity: 4, sealedVials: 3, content: 75 });
});
