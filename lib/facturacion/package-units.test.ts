import { test } from "node:test";
import assert from "node:assert/strict";

import { isPackageLine, packageUnits } from "./package-units.ts";

const areas = { slug: "areas", role: "multiplicador", countsSessions: false };
const dias = { slug: "dias", role: "multiplicador", countsSessions: true };

test("owner's example: 2 areas × 6 days = 12, shown as the locked quantity", () => {
  const v: Record<string, string> = { areas: "2", dias: "6" };
  assert.equal(packageUnits([areas, dias], (s) => v[s]), 12);
});

test("only groups whose multiplier counts visits are package lines", () => {
  assert.equal(isPackageLine([areas, dias]), true);
  assert.equal(isPackageLine([areas]), false);
  assert.equal(isPackageLine([]), false);
});

test("a missing area or day count leaves the units at 0 (line not ready)", () => {
  assert.equal(packageUnits([areas, dias], (s) => (s === "areas" ? "2" : "")), 0);
});
