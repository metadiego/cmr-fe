import assert from "node:assert/strict";
import { test } from "node:test";

import { normalizeBookMultiple } from "./book-multiple.ts";

test("reads the Spanish keys", () => {
  assert.deepEqual(normalizeBookMultiple({ creadas: [1, 2], omitidas: 3, aviso: "x" }), {
    creadas: [1, 2],
    omitidas: 3,
    aviso: "x",
  });
});

test("reads the English keys", () => {
  assert.deepEqual(normalizeBookMultiple({ created: [1], skipped: 2, notice: { a: 1 } }), {
    creadas: [1],
    omitidas: 2,
    aviso: { a: 1 },
  });
});

test("an empty or missing body gives empty defaults", () => {
  const empty = { creadas: [], omitidas: 0, aviso: null };
  assert.deepEqual(normalizeBookMultiple(null), empty);
  assert.deepEqual(normalizeBookMultiple({}), empty);
});

test("zero skipped is kept, not replaced", () => {
  assert.equal(normalizeBookMultiple({ skipped: 0, omitidas: 5 }).omitidas, 0);
});
