import { test } from "node:test";
import assert from "node:assert/strict";

import { invoiceListRange } from "./search-range.ts";

test("a search ignores the date range: «038158» finds S038158 from July", () => {
  assert.deepEqual(invoiceListRange("038158", "2026-11-10", "2026-11-10"), { allDates: true });
});

test("no search: the chosen range applies; blanks mean no bound", () => {
  assert.deepEqual(invoiceListRange("", "2026-11-10", "2026-11-10"), { from: "2026-11-10", to: "2026-11-10", allDates: false });
  assert.deepEqual(invoiceListRange("   ", "", ""), { from: undefined, to: undefined, allDates: false }, "spaces are not a search");
});
