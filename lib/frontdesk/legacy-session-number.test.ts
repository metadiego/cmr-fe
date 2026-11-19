import { test } from "node:test";
import assert from "node:assert/strict";

import { parseLegacySessionNumber } from "./legacy-session-number.ts";

test("a valid n/m with n ≤ m parses to {number, total}", () => {
  assert.deepEqual(parseLegacySessionNumber("5/12"), { number: 5, total: 12 });
  assert.deepEqual(parseLegacySessionNumber("1/1"), { number: 1, total: 1 });
});

test("whitespace around a valid n/m is trimmed", () => {
  assert.deepEqual(parseLegacySessionNumber("  5/12  "), { number: 5, total: 12 });
});

test("n > m is rejected even though both are valid numbers", () => {
  assert.equal(parseLegacySessionNumber("13/12"), null);
});

test("zero or negative on either side is rejected", () => {
  assert.equal(parseLegacySessionNumber("0/12"), null);
  assert.equal(parseLegacySessionNumber("5/0"), null);
});

test("blank, missing slash, non-numeric or decimal text is not a session number", () => {
  for (const v of ["", "—", "5", "5/", "/12", "5/12/3", "a/b", "5.5/12", null, undefined]) {
    assert.equal(parseLegacySessionNumber(v), null);
  }
});
