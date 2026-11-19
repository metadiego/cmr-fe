import { test } from "node:test";
import assert from "node:assert/strict";

import { rowsForPrint } from "./print-rows.ts";

const baked = Array.from({ length: 24 }, (_, i) => ({ terapia: `${i + 1}/24`, fecha: i === 0 ? "2026-11-04" : "" }));

test("fewer therapies: keeps the first rows and renumbers as a fraction of the new total", () => {
  const r = rowsForPrint(baked, 6, "terapia", true);
  assert.equal(r.length, 6);
  assert.deepEqual(r.map((x) => x.terapia), ["1/6", "2/6", "3/6", "4/6", "5/6", "6/6"]);
  assert.equal(r[0].fecha, "2026-11-04"); // today's prefilled row survives
});

test("more therapies than the BE sent: extra rows are blank but numbered", () => {
  const r = rowsForPrint(baked.slice(0, 2), 4, "terapia", false);
  assert.deepEqual(r.map((x) => x.terapia), ["1", "2", "3", "4"]);
  assert.equal(r[3].fecha, undefined);
});

test("no count typed (or invalid): the BE's rows untouched", () => {
  assert.equal(rowsForPrint(baked, null, "terapia", true), baked);
  assert.equal(rowsForPrint(baked, 0, "terapia", true), baked);
  assert.equal(rowsForPrint(baked, 2.5, "terapia", true), baked);
});

test("no counter column: only the number of rows changes", () => {
  const r = rowsForPrint(baked, 3, undefined, true);
  assert.deepEqual(r.map((x) => x.terapia), ["1/24", "2/24", "3/24"]);
});
