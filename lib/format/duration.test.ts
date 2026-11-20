import { test } from "node:test";
import assert from "node:assert/strict";

import { formatDurationMinutes } from "./duration.ts";

test("formats whole hours and minutes", () => {
  assert.equal(formatDurationMinutes(195), "3h 15m");
  assert.equal(formatDurationMinutes(60), "1h");
  assert.equal(formatDurationMinutes(45), "45m");
  assert.equal(formatDurationMinutes(0), "0m");
});

test("rounds fractional minutes and never goes negative", () => {
  assert.equal(formatDurationMinutes(45.6), "46m");
  assert.equal(formatDurationMinutes(-5), "0m");
});
