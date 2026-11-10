import { test } from "node:test";
import assert from "node:assert/strict";

import { normalizeBookMultipleResult } from "./book-multiple.ts";

test("normalizeBookMultipleResult: v2 English keys (cmr-be#524, f63a4e31)", () => {
  assert.deepEqual(
    normalizeBookMultipleResult({ created: [{ id: "s1" }], skipped: 2, notice: { serviceId: "a" } }),
    { creadas: [{ id: "s1" }], omitidas: 2, aviso: { serviceId: "a" } },
  );
});

test("normalizeBookMultipleResult: legacy Spanish keys still read (older BE)", () => {
  assert.deepEqual(
    normalizeBookMultipleResult({ creadas: [{ id: "s2" }], omitidas: 1, aviso: null }),
    { creadas: [{ id: "s2" }], omitidas: 1, aviso: null },
  );
});

test("normalizeBookMultipleResult: English wins when both are present", () => {
  assert.deepEqual(
    normalizeBookMultipleResult({ created: [], creadas: [{ id: "stale" }], skipped: 0, omitidas: 9 }),
    { creadas: [], omitidas: 0, aviso: null },
  );
});

test("normalizeBookMultipleResult: null/undefined response — safe defaults, never throws", () => {
  assert.deepEqual(normalizeBookMultipleResult(null), { creadas: [], omitidas: 0, aviso: null });
  assert.deepEqual(normalizeBookMultipleResult(undefined), { creadas: [], omitidas: 0, aviso: null });
  assert.deepEqual(normalizeBookMultipleResult({}), { creadas: [], omitidas: 0, aviso: null });
});
